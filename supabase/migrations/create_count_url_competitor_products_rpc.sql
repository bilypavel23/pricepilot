-- ============================================================================
-- RPC Function: count_url_competitor_products
-- ============================================================================
-- Counts competitor_products where the competitor has is_tracked=false
-- for a given store_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION count_url_competitor_products(p_store_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count competitor_products for competitors where is_tracked=false
  SELECT COUNT(*)
  INTO v_count
  FROM public.competitor_products cp
  INNER JOIN public.competitors c ON c.id = cp.competitor_id
  WHERE c.store_id = p_store_id
    AND c.is_tracked = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION count_url_competitor_products(UUID) TO authenticated;

