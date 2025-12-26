-- ============================================================================
-- RPC Function: mark_competitor_sync_result
-- ============================================================================
-- Records the result of a competitor price sync run
-- Updates last_competitor_sync_at, last_competitor_sync_status, last_competitor_sync_updated_count
-- ============================================================================

-- Add columns to store_sync_settings table if they don't exist
DO $$ 
BEGIN
  -- Add last_competitor_sync_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_sync_settings' 
    AND column_name = 'last_competitor_sync_at'
  ) THEN
    ALTER TABLE public.store_sync_settings 
    ADD COLUMN last_competitor_sync_at TIMESTAMPTZ;
  END IF;

  -- Add last_competitor_sync_status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_sync_settings' 
    AND column_name = 'last_competitor_sync_status'
  ) THEN
    ALTER TABLE public.store_sync_settings 
    ADD COLUMN last_competitor_sync_status TEXT;
  END IF;

  -- Add last_competitor_sync_updated_count if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'store_sync_settings' 
    AND column_name = 'last_competitor_sync_updated_count'
  ) THEN
    ALTER TABLE public.store_sync_settings 
    ADD COLUMN last_competitor_sync_updated_count INTEGER;
  END IF;
END $$;

-- Function: mark_competitor_sync_result(store_id, status, updated_count)
-- Records the result of a competitor price sync run
CREATE OR REPLACE FUNCTION public.mark_competitor_sync_result(
  p_store_id UUID,
  p_status TEXT,
  p_updated_count INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update store_sync_settings with sync result
  UPDATE public.store_sync_settings
  SET 
    last_competitor_sync_at = NOW(),
    last_competitor_sync_status = p_status,
    last_competitor_sync_updated_count = p_updated_count,
    updated_at = NOW()
  WHERE store_id = p_store_id;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.mark_competitor_sync_result(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_competitor_sync_result(UUID, TEXT, INTEGER) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.mark_competitor_sync_result(UUID, TEXT, INTEGER) IS 
  'Records the result of a competitor price sync run. Updates last_competitor_sync_at, last_competitor_sync_status, and last_competitor_sync_updated_count.';


