-- ============================================================================
-- Fix Competitor Discovery Workflow
-- ============================================================================
-- This migration:
-- 1. Adds name_norm columns to products and competitor_products
-- 2. Creates normalize_title() function
-- 3. Creates discovery quota system (6000 products/month)
-- 4. Creates match_candidates and product_matches tables
-- 5. Works with existing competitor_id column (not competitor_store_id)
-- ============================================================================

-- ============================================================================
-- 1. ENABLE PG_TRGM EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. ADD NAME_NORM COLUMNS
-- ============================================================================

-- Add name_norm to products table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'name_norm'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN name_norm TEXT;
  END IF;
END $$;

-- Add name_norm to competitor_products table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_products' 
    AND column_name = 'name_norm'
  ) THEN
    ALTER TABLE public.competitor_products 
    ADD COLUMN name_norm TEXT;
  END IF;
END $$;

-- Add last_price_hash to competitor_products if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_products' 
    AND column_name = 'last_price_hash'
  ) THEN
    ALTER TABLE public.competitor_products 
    ADD COLUMN last_price_hash TEXT;
  END IF;
END $$;

-- Create GIN indexes for trigram similarity
CREATE INDEX IF NOT EXISTS idx_products_name_norm_trgm 
ON public.products USING gin(name_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_competitor_products_name_norm_trgm 
ON public.competitor_products USING gin(name_norm gin_trgm_ops);

-- ============================================================================
-- 3. NORMALIZE_TITLE FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_title(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Lowercase, remove diacritics (if unaccent extension available), remove punctuation, collapse whitespace
  RETURN lower(
    regexp_replace(
      regexp_replace(
        COALESCE(unaccent(input_text), input_text), -- Use unaccent if available, fallback to original
        '[^a-z0-9\s]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 4. TRIGGERS FOR NAME_NORM
-- ============================================================================

-- Trigger function to update name_norm
CREATE OR REPLACE FUNCTION update_name_norm()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    NEW.name_norm := normalize_title(NEW.name);
  ELSIF TG_TABLE_NAME = 'competitor_products' THEN
    NEW.name_norm := normalize_title(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_name_norm'
  ) THEN
    CREATE TRIGGER update_products_name_norm
      BEFORE INSERT OR UPDATE OF name ON public.products
      FOR EACH ROW EXECUTE FUNCTION update_name_norm();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_competitor_products_name_norm'
  ) THEN
    CREATE TRIGGER update_competitor_products_name_norm
      BEFORE INSERT OR UPDATE OF name ON public.competitor_products
      FOR EACH ROW EXECUTE FUNCTION update_name_norm();
  END IF;
END $$;

-- Backfill existing rows
UPDATE public.products SET name_norm = normalize_title(name) WHERE name_norm IS NULL;
UPDATE public.competitor_products SET name_norm = normalize_title(name) WHERE name_norm IS NULL;

-- ============================================================================
-- 5. DISCOVERY QUOTA TABLE
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
-- 6. MATCH_CANDIDATES TABLE (using competitor_id)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competitor_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  my_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (competitor_id, my_product_id, competitor_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_candidates_competitor_id 
ON public.competitor_match_candidates(competitor_id);
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
      WHERE c.id = competitor_match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert match candidates for their stores"
  ON public.competitor_match_candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete match candidates for their stores"
  ON public.competitor_match_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. COMPETITOR_PRODUCT_MATCHES TABLE (final confirmed matches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competitor_product_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  my_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One competitor per my product per store (enforced at application level per store_id)
  UNIQUE (competitor_id, my_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_matches_competitor_id 
ON public.competitor_product_matches(competitor_id);
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
      WHERE c.id = competitor_product_matches.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product matches for their stores"
  ON public.competitor_product_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_product_matches.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product matches for their stores"
  ON public.competitor_product_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_product_matches.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. HELPER FUNCTIONS
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

-- Function to find similar products using trigram similarity
CREATE OR REPLACE FUNCTION find_similar_products(
  p_competitor_name_norm TEXT,
  p_store_id UUID,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  product_id UUID,
  similarity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    similarity(p.name_norm, p_competitor_name_norm) * 100 as similarity
  FROM public.products p
  WHERE p.store_id = p_store_id
  AND p.name_norm IS NOT NULL
  AND p.is_demo = false
  AND similarity(p.name_norm, p_competitor_name_norm) >= 0.3
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

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

