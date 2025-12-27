-- Add sync_frequency column to store_sync_settings table
-- Defaults to 'daily' for existing rows

DO $$ 
BEGIN
  -- Add sync_frequency if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_sync_settings' 
    AND column_name = 'sync_frequency'
  ) THEN
    ALTER TABLE public.store_sync_settings 
    ADD COLUMN sync_frequency TEXT NOT NULL DEFAULT 'daily';
  END IF;
END $$;


