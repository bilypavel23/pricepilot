-- Add columns to competitors table for source tracking and domain grouping
ALTER TABLE public.competitors
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'store',
ADD COLUMN IF NOT EXISTS is_tracked boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS domain text;

-- Add unique index to avoid duplicate domain groups for non-tracked competitors
-- This ensures one competitor per domain per store for "Added by URL" competitors
CREATE UNIQUE INDEX IF NOT EXISTS competitors_store_domain_unique
ON public.competitors (store_id, domain)
WHERE is_tracked = false;

-- Update existing rows to populate domain from URL if not set
-- (source and is_tracked already have defaults, but domain needs to be computed)
UPDATE public.competitors
SET 
  domain = CASE 
    WHEN url IS NOT NULL AND (domain IS NULL OR domain = '') THEN 
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(url, '^https?://', ''), '^www\.', ''))
    ELSE domain
  END
WHERE domain IS NULL OR domain = '';

