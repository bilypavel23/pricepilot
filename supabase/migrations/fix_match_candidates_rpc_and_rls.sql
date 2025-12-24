-- ============================================================================
-- Fix get_competitor_products_for_store_matches RPC and RLS Policy
-- ============================================================================
-- This migration:
-- 1. Drops and recreates get_competitor_products_for_store_matches to use last_price (not competitor_price)
-- 2. Fixes JOIN to use suggested_product_id (not product_id)
-- 3. Updates RLS policy to use stores.owner_id (not stores.user_id)
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_competitor_products_for_store_matches(UUID, UUID, NUMERIC);

-- Recreate function with correct column references
CREATE OR REPLACE FUNCTION public.get_competitor_products_for_store_matches(
  _store_id UUID,
  _competitor_id UUID,
  _min_score NUMERIC DEFAULT 0
)
RETURNS TABLE (
  candidate_id UUID,
  store_id UUID,
  competitor_id UUID,
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  product_price NUMERIC(10, 2),
  competitor_url TEXT,
  competitor_name TEXT,
  competitor_price NUMERIC(10, 2),
  currency TEXT,
  similarity_score NUMERIC(5, 2),
  last_checked_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as candidate_id,
    c.store_id,
    c.competitor_id,
    c.suggested_product_id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    p.price as product_price,
    c.competitor_url,
    c.competitor_name,
    COALESCE(c.last_price, 0)::NUMERIC as competitor_price,
    COALESCE(c.currency, 'USD') as currency,
    c.similarity_score,
    c.last_checked_at
  FROM public.competitor_match_candidates c
  LEFT JOIN public.products p ON p.id = c.suggested_product_id
  WHERE c.store_id = _store_id
  AND c.competitor_id = _competitor_id
  AND (c.similarity_score IS NULL OR c.similarity_score >= _min_score)
  ORDER BY c.similarity_score DESC NULLS LAST, p.name ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_competitor_products_for_store_matches(UUID, UUID, NUMERIC) TO authenticated;

-- Enable RLS on competitor_match_candidates if not already enabled
ALTER TABLE public.competitor_match_candidates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS candidates_select_own_store ON public.competitor_match_candidates;

-- Create RLS policy using stores.owner_id (NOT stores.user_id)
CREATE POLICY candidates_select_own_store
ON public.competitor_match_candidates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.stores s 
    WHERE s.id = competitor_match_candidates.store_id 
    AND s.owner_id = auth.uid()
  )
);

