-- ============================================================================
-- RPC Function: mark_products_sync
-- ============================================================================
-- Records that a products sync was completed for a store
-- Updates last_products_sync_at timestamp and products_sync_source
-- ============================================================================

-- Add columns to stores table if they don't exist
DO $$ 
BEGIN
  -- Add last_products_sync_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'stores' 
    AND column_name = 'last_products_sync_at'
  ) THEN
    ALTER TABLE public.stores 
    ADD COLUMN last_products_sync_at TIMESTAMPTZ;
  END IF;

  -- Add products_sync_source if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'stores' 
    AND column_name = 'products_sync_source'
  ) THEN
    ALTER TABLE public.stores 
    ADD COLUMN products_sync_source TEXT;
  END IF;
END $$;

-- Function: mark_products_sync(store_id, source)
-- Records that a products sync was completed for a store
CREATE OR REPLACE FUNCTION public.mark_products_sync(
  p_store_id UUID,
  p_source TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update store with sync timestamp and source
  UPDATE public.stores
  SET 
    last_products_sync_at = NOW(),
    products_sync_source = p_source,
    updated_at = NOW()
  WHERE id = p_store_id;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.mark_products_sync(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_products_sync(UUID, TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.mark_products_sync(UUID, TEXT) IS 
  'Records that a products sync was completed. Updates last_products_sync_at and products_sync_source. This timestamp is the single source of truth for "Last sync" in UI.';


