-- Add sync_enabled column to store_sync_settings table
-- Defaults to true for existing rows

DO $$ 
BEGIN
  -- Add sync_enabled if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_sync_settings' 
    AND column_name = 'sync_enabled'
  ) THEN
    ALTER TABLE public.store_sync_settings 
    ADD COLUMN sync_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;



