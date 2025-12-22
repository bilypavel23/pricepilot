-- ============================================================================
-- Create v_product_competitor_links view
-- ============================================================================
-- This view combines:
-- 1. Store competitors from competitor_product_matches (competitor_id is set)
-- 2. URL competitors (competitor_id is null, from product_competitors or similar)
-- ============================================================================

-- Drop view if exists
DROP VIEW IF EXISTS public.v_product_competitor_links;

-- Create view that combines Store and URL competitors
CREATE OR REPLACE VIEW public.v_product_competitor_links AS
SELECT 
  -- Common fields
  cpm.store_id,
  cpm.product_id,
  cpm.competitor_id,  -- NULL for URL competitors, set for Store competitors
  cpm.competitor_name,
  cpm.competitor_url,
  cpm.competitor_price,
  cpm.competitor_price AS last_price,  -- For Store competitors, competitor_price is the last_price
  COALESCE(cpm.currency, 'USD') AS currency,
  CASE 
    WHEN cpm.competitor_id IS NOT NULL THEN 'Store'
    ELSE 'URL'
  END AS source,
  cpm.last_checked_at,
  cpm.created_at,
  cpm.updated_at
FROM public.competitor_product_matches cpm
WHERE cpm.store_id IS NOT NULL
  AND cpm.product_id IS NOT NULL
  AND cpm.competitor_name IS NOT NULL
  AND cpm.competitor_url IS NOT NULL

UNION ALL

-- URL competitors from competitor_url_products table
-- These are competitors added by URL (competitor_id is always NULL)
SELECT 
  cup.store_id,
  cup.product_id,
  NULL::UUID AS competitor_id,  -- Always NULL for URL competitors
  cup.competitor_name,
  cup.competitor_url,
  cup.last_price AS competitor_price,  -- For URL competitors, last_price is the primary field
  cup.last_price,  -- Keep last_price as separate column
  COALESCE(cup.currency, 'USD') AS currency,
  'URL' AS source,
  cup.last_checked_at,
  cup.created_at,
  cup.updated_at
FROM public.competitor_url_products cup
WHERE cup.store_id IS NOT NULL
  AND cup.product_id IS NOT NULL
  AND cup.competitor_name IS NOT NULL
  AND cup.competitor_url IS NOT NULL
  -- Exclude rows that are already in competitor_product_matches
  AND NOT EXISTS (
    SELECT 1 
    FROM public.competitor_product_matches cpm2
    WHERE cpm2.store_id = cup.store_id
      AND cpm2.product_id = cup.product_id
      AND cpm2.competitor_url = cup.competitor_url
  );

-- Grant permissions
GRANT SELECT ON public.v_product_competitor_links TO authenticated;
GRANT SELECT ON public.v_product_competitor_links TO anon;

-- Add comment
COMMENT ON VIEW public.v_product_competitor_links IS 
  'Unified view of product-competitor links from both Store competitors (competitor_product_matches) and URL competitors (product_competitors). competitor_id is NULL for URL competitors.';

