-- ============================================================================
-- Update Competitors Status Column
-- ============================================================================
-- Updates the status column to support: active, paused, pending, error
-- Adds index on (store_id, status) for efficient queries
-- ============================================================================

-- Drop existing check constraint if it exists (with different values)
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'competitors' 
    AND constraint_name LIKE '%status%check%'
  ) THEN
    ALTER TABLE public.competitors DROP CONSTRAINT IF EXISTS competitors_status_check;
  END IF;
END $$;

-- Ensure status column is NOT NULL with default
ALTER TABLE public.competitors 
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active';

-- Add check constraint for allowed status values
ALTER TABLE public.competitors 
  ADD CONSTRAINT competitors_status_check 
    CHECK (status IN ('active', 'paused', 'pending', 'error'));

-- Update existing status values to match new constraint
-- Map old values to new ones:
-- 'scanning' -> 'pending'
-- 'needs_review' -> 'pending'
-- 'quota_exceeded' -> 'error'
-- 'active' -> 'active'
-- 'error' -> 'error'
UPDATE public.competitors
SET status = CASE
  WHEN status = 'scanning' THEN 'pending'
  WHEN status = 'needs_review' THEN 'pending'
  WHEN status = 'quota_exceeded' THEN 'error'
  WHEN status IN ('active', 'error') THEN status
  ELSE 'active' -- fallback for any other values
END
WHERE status IS NOT NULL;

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_competitors_status;

-- Create new index on (store_id, status) for efficient queries
CREATE INDEX IF NOT EXISTS idx_competitors_store_id_status 
ON public.competitors(store_id, status);

-- Also create index on status alone for filtering
CREATE INDEX IF NOT EXISTS idx_competitors_status 
ON public.competitors(status);

