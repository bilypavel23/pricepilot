-- ============================================================================
-- Competitor Discovery & Matching System
-- ============================================================================
-- This migration creates tables and functions for:
-- 1. Discovery quota tracking (6000 products/month per store)
-- 2. Match candidates (suggested matches before confirmation)
-- 3. Product matches (confirmed matches)
-- 4. Price check optimization (skip unchanged)
-- ============================================================================

-- ============================================================================
-- 1. ENABLE PG_TRGM EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. COMPETITOR_DISCOVERY_QUOTA TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competitor_discovery_quota (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL, -- Format: 'YYYY-MM'
  limit_products INTEGER NOT NULL DEFAULT 6000,
  used_products INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (store_id, month_key),
  CONSTRAINT valid_month_key CHECK (month_key ~ '^\d{4}-\d{2}$')
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_discovery_quota_store_month 
ON public.competitor_discovery_quota(store_id, month_key);

-- RLS policies
ALTER TABLE public.competitor_discovery_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discovery quota for their stores"
  ON public.competitor_discovery_quota FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = competitor_discovery_quota.store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert discovery quota for their stores"
  ON public.competitor_discovery_quota FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = competitor_discovery_quota.store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update discovery quota for their stores"
  ON public.competitor_discovery_quota FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = competitor_discovery_quota.store_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. ENSURE COMPETITOR_PRODUCTS HAS REQUIRED COLUMNS
-- ============================================================================
DO $$ 
BEGIN
  -- Add title_norm if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_products' 
    AND column_name = 'title_norm'
  ) THEN
    ALTER TABLE public.competitor_products 
    ADD COLUMN title_norm TEXT;
  END IF;

  -- Add last_price_hash if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_products' 
    AND column_name = 'last_price_hash'
  ) THEN
    ALTER TABLE public.competitor_products 
    ADD COLUMN last_price_hash TEXT;
  END IF;

  -- Ensure competitor_store_id exists (may be named competitor_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_products' 
    AND column_name = 'competitor_store_id'
  ) THEN
    -- Check if competitor_id exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'competitor_products' 
      AND column_name = 'competitor_id'
    ) THEN
      ALTER TABLE public.competitor_products 
      RENAME COLUMN competitor_id TO competitor_store_id;
    ELSE
      -- Add new column if neither exists
      ALTER TABLE public.competitor_products 
      ADD COLUMN competitor_store_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Ensure name column exists (may be named title)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_products' 
    AND column_name = 'name'
  ) THEN
    -- Check if title exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'competitor_products' 
      AND column_name = 'title'
    ) THEN
      ALTER TABLE public.competitor_products 
      RENAME COLUMN title TO name;
    ELSE
      -- Add new column if neither exists
      ALTER TABLE public.competitor_products 
      ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;
END $$;

-- Create GIN index for trigram similarity on title_norm
CREATE INDEX IF NOT EXISTS idx_competitor_products_title_norm_trgm 
ON public.competitor_products USING gin(title_norm gin_trgm_ops);

-- ============================================================================
-- 4. ENSURE PRODUCTS HAS TITLE_NORM COLUMN
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'title_norm'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN title_norm TEXT;
  END IF;
END $$;

-- Create GIN index for trigram similarity on title_norm
CREATE INDEX IF NOT EXISTS idx_products_title_norm_trgm 
ON public.products USING gin(title_norm gin_trgm_ops);

-- ============================================================================
-- 5. COMPETITOR_MATCH_CANDIDATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competitor_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_store_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  my_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (competitor_store_id, my_product_id, competitor_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_candidates_store 
ON public.competitor_match_candidates(competitor_store_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_my_product 
ON public.competitor_match_candidates(my_product_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_competitor_product 
ON public.competitor_match_candidates(competitor_product_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_score 
ON public.competitor_match_candidates(score DESC);

-- RLS policies
ALTER TABLE public.competitor_match_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view match candidates for their stores"
  ON public.competitor_match_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_match_candidates.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert match candidates for their stores"
  ON public.competitor_match_candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_match_candidates.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete match candidates for their stores"
  ON public.competitor_match_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_match_candidates.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. COMPETITOR_PRODUCT_MATCHES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competitor_product_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_store_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  my_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One competitor per my product per store
  UNIQUE (competitor_store_id, my_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_matches_store 
ON public.competitor_product_matches(competitor_store_id);
CREATE INDEX IF NOT EXISTS idx_product_matches_my_product 
ON public.competitor_product_matches(my_product_id);
CREATE INDEX IF NOT EXISTS idx_product_matches_competitor_product 
ON public.competitor_product_matches(competitor_product_id);

-- RLS policies
ALTER TABLE public.competitor_product_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product matches for their stores"
  ON public.competitor_product_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_product_matches.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product matches for their stores"
  ON public.competitor_product_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_product_matches.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product matches for their stores"
  ON public.competitor_product_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_product_matches.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product matches for their stores"
  ON public.competitor_product_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_product_matches.competitor_store_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to ensure current month's discovery quota exists
CREATE OR REPLACE FUNCTION ensure_current_discovery_quota(p_store_id UUID)
RETURNS TABLE (
  store_id UUID,
  month_key TEXT,
  limit_products INTEGER,
  used_products INTEGER,
  remaining_products INTEGER
) AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
BEGIN
  -- Insert or get existing quota for current month
  INSERT INTO public.competitor_discovery_quota (store_id, month_key, limit_products, used_products)
  VALUES (p_store_id, v_current_month, 6000, 0)
  ON CONFLICT (store_id, month_key) DO NOTHING;
  
  -- Return current quota
  RETURN QUERY
  SELECT 
    dq.store_id,
    dq.month_key,
    dq.limit_products,
    dq.used_products,
    (dq.limit_products - dq.used_products) as remaining_products
  FROM public.competitor_discovery_quota dq
  WHERE dq.store_id = p_store_id
  AND dq.month_key = v_current_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume discovery products
CREATE OR REPLACE FUNCTION consume_discovery_products(
  p_store_id UUID,
  p_amount INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_products INTEGER,
  used_products INTEGER,
  limit_products INTEGER
) AS $$
DECLARE
  v_quota RECORD;
  v_current_month TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
BEGIN
  -- Ensure quota exists
  PERFORM ensure_current_discovery_quota(p_store_id);
  
  -- Get current quota
  SELECT * INTO v_quota
  FROM ensure_current_discovery_quota(p_store_id);
  
  -- Check if allowed
  IF (v_quota.used_products + p_amount) > v_quota.limit_products THEN
    RETURN QUERY SELECT 
      false as allowed,
      (v_quota.limit_products - v_quota.used_products) as remaining_products,
      v_quota.used_products,
      v_quota.limit_products;
    RETURN;
  END IF;
  
  -- Consume quota
  UPDATE public.competitor_discovery_quota
  SET 
    used_products = used_products + p_amount,
    updated_at = NOW()
  WHERE store_id = p_store_id
  AND month_key = v_current_month;
  
  -- Return updated quota
  RETURN QUERY
  SELECT 
    true as allowed,
    (v_quota.limit_products - v_quota.used_products - p_amount) as remaining_products,
    (v_quota.used_products + p_amount) as used_products,
    v_quota.limit_products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to normalize title (for use in triggers or application code)
CREATE OR REPLACE FUNCTION normalize_title(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN lower(
    regexp_replace(
      regexp_replace(
        unaccent(input_text),
        '[^a-z0-9\s]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 8. TRIGGERS FOR TITLE_NORM
-- ============================================================================

-- Trigger function to update title_norm
CREATE OR REPLACE FUNCTION update_title_norm()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    NEW.title_norm := normalize_title(NEW.name);
  ELSIF TG_TABLE_NAME = 'competitor_products' THEN
    NEW.title_norm := normalize_title(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_title_norm'
  ) THEN
    CREATE TRIGGER update_products_title_norm
      BEFORE INSERT OR UPDATE OF name ON public.products
      FOR EACH ROW EXECUTE FUNCTION update_title_norm();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_competitor_products_title_norm'
  ) THEN
    CREATE TRIGGER update_competitor_products_title_norm
      BEFORE INSERT OR UPDATE OF name ON public.competitor_products
      FOR EACH ROW EXECUTE FUNCTION update_title_norm();
  END IF;
END $$;

-- ============================================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_discovery_quota_updated_at'
  ) THEN
    CREATE TRIGGER update_discovery_quota_updated_at
      BEFORE UPDATE ON public.competitor_discovery_quota
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_matches_updated_at'
  ) THEN
    CREATE TRIGGER update_product_matches_updated_at
      BEFORE UPDATE ON public.competitor_product_matches
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 10. SIMILARITY SEARCH FUNCTION (for trigram matching)
-- ============================================================================
CREATE OR REPLACE FUNCTION similarity_search(
  search_text TEXT,
  match_threshold NUMERIC DEFAULT 0.3,
  result_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  product_id UUID,
  similarity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    similarity(p.title_norm, search_text) as similarity
  FROM public.products p
  WHERE p.title_norm IS NOT NULL
  AND similarity(p.title_norm, search_text) >= match_threshold
  ORDER BY similarity DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 11. PRODUCT LIMIT CONSTRAINT (150 products per store)
-- ============================================================================
-- Note: This is enforced at application level, but we can add a check constraint
-- if needed. For now, we'll rely on application-level enforcement.

