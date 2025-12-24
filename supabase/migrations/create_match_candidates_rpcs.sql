-- ============================================================================
-- Create RPC Functions for Match Candidates
-- ============================================================================
-- This migration creates:
-- 1. build_match_candidates_for_competitor_store - builds candidates from competitor_store_products
-- 2. get_competitor_products_for_store_matches - returns candidates for review
-- ============================================================================

-- ============================================================================
-- 1. ENSURE COMPETITOR_MATCH_CANDIDATES HAS REQUIRED COLUMNS
-- ============================================================================
-- Add store_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_match_candidates_store_id 
    ON public.competitor_match_candidates(store_id);
  END IF;
END $$;

-- Add competitor_name if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'competitor_name'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    ADD COLUMN competitor_name TEXT;
  END IF;
END $$;

-- Add competitor_url if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'competitor_url'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    ADD COLUMN competitor_url TEXT;
  END IF;
END $$;

-- Add competitor_price if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'competitor_price'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    ADD COLUMN competitor_price NUMERIC(10, 2);
  END IF;
END $$;

-- Add currency if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;
END $$;

-- Add last_checked_at if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'last_checked_at'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    ADD COLUMN last_checked_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add suggested_product_id if missing (renamed from my_product_id for clarity)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'suggested_product_id'
  ) THEN
    -- Check if my_product_id exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'competitor_match_candidates' 
      AND column_name = 'my_product_id'
    ) THEN
      ALTER TABLE public.competitor_match_candidates 
      RENAME COLUMN my_product_id TO suggested_product_id;
    ELSE
      ALTER TABLE public.competitor_match_candidates 
      ADD COLUMN suggested_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Rename score to similarity_score if needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'score'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_match_candidates' 
    AND column_name = 'similarity_score'
  ) THEN
    ALTER TABLE public.competitor_match_candidates 
    RENAME COLUMN score TO similarity_score;
  END IF;
END $$;

-- ============================================================================
-- 2. BUILD_MATCH_CANDIDATES_FOR_COMPETITOR_STORE RPC
-- ============================================================================
-- This function:
-- 1. Deletes old candidates for (store_id, competitor_id)
-- 2. Inserts new candidates from competitor_store_products using pg_trgm similarity
-- 3. Uses similarity >= 0.70 threshold
-- 4. Keeps only top-1 match per competitor_store_products row
-- 5. Returns inserted count
-- ============================================================================
CREATE OR REPLACE FUNCTION build_match_candidates_for_competitor_store(
  p_store_id UUID,
  p_competitor_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  -- Step 1: Delete old candidates for this store+competitor
  DELETE FROM public.competitor_match_candidates
  WHERE store_id = p_store_id
  AND competitor_id = p_competitor_id;
  
  -- Step 2: Insert new candidates from competitor_store_products
  -- Match using pg_trgm similarity on competitor_name vs products.name
  -- Use normalized names if available (name_norm), otherwise use raw names
  -- Keep only top-1 match per competitor_store_products row (highest similarity)
  WITH ranked_matches AS (
    SELECT DISTINCT ON (sp.id)
      p_store_id as store_id,
      p_competitor_id as competitor_id,
      sp.id as competitor_product_id,
      p.id as suggested_product_id,
      similarity(
        COALESCE(
          normalize_title(sp.competitor_name),
          lower(COALESCE(sp.competitor_name, ''))
        ),
        COALESCE(p.name_norm, lower(COALESCE(p.name, '')))
      ) as similarity_score,
      sp.competitor_name,
      sp.competitor_url,
      sp.competitor_price,
      COALESCE(sp.currency, 'USD') as currency,
      NOW() as last_checked_at
    FROM public.competitor_store_products sp
    CROSS JOIN public.products p
    WHERE sp.store_id = p_store_id
    AND sp.competitor_id = p_competitor_id
    AND p.store_id = p_store_id
    AND p.is_demo = false
    AND sp.competitor_name IS NOT NULL
    AND p.name IS NOT NULL
    AND similarity(
      COALESCE(
        normalize_title(sp.competitor_name),
        lower(COALESCE(sp.competitor_name, ''))
      ),
      COALESCE(p.name_norm, lower(COALESCE(p.name, '')))
    ) >= 0.70
    ORDER BY sp.id, similarity(
      COALESCE(
        normalize_title(sp.competitor_name),
        lower(COALESCE(sp.competitor_name, ''))
      ),
      COALESCE(p.name_norm, lower(COALESCE(p.name, '')))
    ) DESC
  )
  INSERT INTO public.competitor_match_candidates (
    store_id,
    competitor_id,
    competitor_product_id,
    suggested_product_id,
    similarity_score,
    competitor_name,
    competitor_url,
    competitor_price,
    currency,
    last_checked_at
  )
  SELECT 
    store_id,
    competitor_id,
    competitor_product_id,
    suggested_product_id,
    similarity_score * 100, -- Convert to 0-100 scale
    competitor_name,
    competitor_url,
    competitor_price,
    currency,
    last_checked_at
  FROM ranked_matches;
  
  -- Get inserted count
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. GET_COMPETITOR_PRODUCTS_FOR_STORE_MATCHES RPC
-- ============================================================================
-- This function returns candidate rows from competitor_match_candidates
-- filtered by store_id + competitor_id, joined with products for display
-- ============================================================================
CREATE OR REPLACE FUNCTION get_competitor_products_for_store_matches(
  _store_id UUID,
  _competitor_id UUID,
  _min_score NUMERIC DEFAULT 15
)
RETURNS TABLE (
  candidate_id UUID,
  product_name TEXT,
  product_sku TEXT,
  product_price NUMERIC(10, 2),
  competitor_name TEXT,
  competitor_price NUMERIC(10, 2),
  competitor_url TEXT,
  similarity_score NUMERIC(5, 2),
  currency TEXT,
  suggested_product_id UUID,
  competitor_product_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cmc.id as candidate_id,
    p.name as product_name,
    p.sku as product_sku,
    p.price as product_price,
    cmc.competitor_name,
    cmc.last_price as competitor_price,
    cmc.competitor_url,
    cmc.similarity_score,
    COALESCE(cmc.currency, 'USD') as currency,
    cmc.suggested_product_id,
    cmc.competitor_product_id
  FROM public.competitor_match_candidates cmc
  LEFT JOIN public.products p ON p.id = cmc.suggested_product_id
  WHERE cmc.store_id = _store_id
  AND cmc.competitor_id = _competitor_id
  AND (cmc.similarity_score IS NULL OR cmc.similarity_score >= _min_score)
  ORDER BY cmc.similarity_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 4. CLEANUP_COMPETITOR_STORE_PRODUCTS RPC (Optional)
-- ============================================================================
-- This function deletes competitor_store_products for a given store+competitor
-- Should ONLY be called AFTER candidates are successfully built (count > 0)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_competitor_store_products(
  p_store_id UUID,
  p_competitor_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Delete all competitor_store_products for this store+competitor
  DELETE FROM public.competitor_store_products
  WHERE store_id = p_store_id
  AND competitor_id = p_competitor_id;
  
  -- Get deleted count
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION build_match_candidates_for_competitor_store(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_competitor_products_for_store_matches(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_competitor_store_products(UUID, UUID) TO authenticated;

