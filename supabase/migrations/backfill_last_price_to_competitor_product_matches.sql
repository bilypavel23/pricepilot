-- ============================================================================
-- Backfill last_price into competitor_product_matches
-- ============================================================================
-- This migration copies last_price from competitor_store_products into 
-- competitor_product_matches for existing rows that have null last_price.
-- 
-- Join key: store_id + competitor_id + competitor_product_id (best key)
-- ============================================================================

-- Add last_price column to competitor_product_matches if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'last_price'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN last_price NUMERIC(10, 2);
  END IF;
END $$;

-- Backfill last_price from competitor_store_products
-- Join by store_id + competitor_id + competitor_product_id (best key)
UPDATE public.competitor_product_matches cpm
SET last_price = csp.last_price
FROM public.competitor_store_products csp
WHERE cpm.store_id = csp.store_id
  AND cpm.competitor_id = csp.competitor_id
  AND cpm.competitor_product_id = csp.id
  AND cpm.last_price IS NULL
  AND csp.last_price IS NOT NULL;

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
  total_with_null INTEGER;
BEGIN
  -- Count how many rows were updated
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Count how many rows still have null last_price
  SELECT COUNT(*) INTO total_with_null
  FROM public.competitor_product_matches
  WHERE last_price IS NULL;
  
  RAISE NOTICE 'Backfill completed: Updated % rows with last_price. % rows still have null last_price.', 
    updated_count, total_with_null;
END $$;

