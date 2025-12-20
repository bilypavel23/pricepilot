-- ============================================================================
-- RPC Function: count_matches_for_competitor_store
-- ============================================================================
-- Counts confirmed matches (competitor_product_matches) for a specific
-- competitor store, ensuring RLS policies are respected.
-- ============================================================================

CREATE OR REPLACE FUNCTION count_matches_for_competitor_store(
  p_store_id UUID,
  p_competitor_store_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count competitor_product_matches for the given competitor
  -- Join with competitors to ensure it belongs to the store
  SELECT COUNT(*)
  INTO v_count
  FROM public.competitor_product_matches cpm
  INNER JOIN public.competitors c ON c.id = cpm.competitor_id
  WHERE cpm.competitor_id = p_competitor_store_id
    AND c.store_id = p_store_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION count_matches_for_competitor_store(UUID, UUID) TO authenticated;

