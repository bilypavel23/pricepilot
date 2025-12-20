-- ============================================================================
-- Competitor Store Onboarding Flow - Database Schema
-- ============================================================================
-- This migration creates tables for:
-- 1. competitor_stores: Enhanced competitor store tracking with status
-- 2. match_candidates: Suggested matches before confirmation
-- 3. discovery_quota: Monthly discovery quota tracking (6,000 products/month)
-- 4. Updates to existing tables as needed
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE COMPETITORS TABLE (add status field if not exists)
-- ============================================================================
-- Add status column to competitors table for onboarding flow
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitors' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.competitors 
    ADD COLUMN status TEXT DEFAULT 'active' 
    CHECK (status IN ('scanning', 'needs_review', 'active', 'quota_exceeded', 'error'));
    
    -- Add index for status queries
    CREATE INDEX IF NOT EXISTS idx_competitors_status 
    ON public.competitors(status) WHERE status IN ('scanning', 'needs_review');
  END IF;
END $$;

-- Add error_message field for quota/error tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitors' 
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.competitors 
    ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- ============================================================================
-- 2. ENSURE COMPETITOR_PRODUCTS TABLE EXISTS (with required fields)
-- ============================================================================
-- Check if competitor_products table exists, create if not
CREATE TABLE IF NOT EXISTS public.competitor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  
  -- Product info from scraping
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  price NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  external_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one product per competitor per URL
  UNIQUE (competitor_id, url)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitor_products_competitor_id 
ON public.competitor_products(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_products_url 
ON public.competitor_products(url);

-- RLS policies
ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competitor products for their stores"
  ON public.competitor_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_products.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert competitor products for their stores"
  ON public.competitor_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_products.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update competitor products for their stores"
  ON public.competitor_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = competitor_products.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. MATCH_CANDIDATES TABLE
-- ============================================================================
-- Stores suggested matches before user confirmation
CREATE TABLE IF NOT EXISTS public.match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  my_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Similarity score (0-100)
  similarity_score INTEGER NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 100),
  
  -- Status: 'pending' (needs review), 'confirmed' (user confirmed), 'rejected' (user rejected)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique: one candidate per competitor_product
  UNIQUE (competitor_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_candidates_competitor_id 
ON public.match_candidates(competitor_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_my_product_id 
ON public.match_candidates(my_product_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_status 
ON public.match_candidates(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_match_candidates_similarity 
ON public.match_candidates(similarity_score DESC);

-- RLS policies
ALTER TABLE public.match_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view match candidates for their stores"
  ON public.match_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert match candidates for their stores"
  ON public.match_candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update match candidates for their stores"
  ON public.match_candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete match candidates for their stores"
  ON public.match_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitors c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = match_candidates.competitor_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. PRODUCT_COMPETITORS TABLE (final confirmed matches)
-- ============================================================================
-- Stores confirmed matches linking my products to competitor products
CREATE TABLE IF NOT EXISTS public.product_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  
  -- Snapshot fields
  competitor_url TEXT NOT NULL,
  competitor_title TEXT NOT NULL,
  last_seen_price NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Timestamps
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique: one match per product-competitor pair
  UNIQUE (product_id, competitor_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_competitors_product_id 
ON public.product_competitors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_competitors_competitor_id 
ON public.product_competitors(competitor_id);
CREATE INDEX IF NOT EXISTS idx_product_competitors_competitor_product_id 
ON public.product_competitors(competitor_product_id);

-- RLS policies
ALTER TABLE public.product_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product competitors for their stores"
  ON public.product_competitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_competitors.product_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product competitors for their stores"
  ON public.product_competitors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_competitors.product_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product competitors for their stores"
  ON public.product_competitors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_competitors.product_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product competitors for their stores"
  ON public.product_competitors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_competitors.product_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. DISCOVERY_QUOTA TABLE
-- ============================================================================
-- Tracks monthly discovery quota (6,000 competitor products per month)
CREATE TABLE IF NOT EXISTS public.discovery_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  
  -- Monthly tracking
  period_start DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  used INTEGER NOT NULL DEFAULT 0,
  limit_amount INTEGER NOT NULL DEFAULT 6000,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast store lookup
CREATE INDEX IF NOT EXISTS idx_discovery_quota_store_id 
ON public.discovery_quota(store_id);

-- RLS policies
ALTER TABLE public.discovery_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discovery quota for their stores"
  ON public.discovery_quota FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = discovery_quota.store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert discovery quota for their stores"
  ON public.discovery_quota FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = discovery_quota.store_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update discovery quota for their stores"
  ON public.discovery_quota FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = discovery_quota.store_id
      AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to reset monthly discovery quota
CREATE OR REPLACE FUNCTION reset_monthly_discovery_quota()
RETURNS void AS $$
BEGIN
  UPDATE public.discovery_quota
  SET 
    used = 0,
    period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE,
    updated_at = NOW()
  WHERE period_start < DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create discovery quota for a store
CREATE OR REPLACE FUNCTION get_or_create_discovery_quota(p_store_id UUID)
RETURNS TABLE (
  store_id UUID,
  period_start DATE,
  used INTEGER,
  limit_amount INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
  -- Ensure quota record exists
  INSERT INTO public.discovery_quota (store_id, period_start, used, limit_amount)
  VALUES (p_store_id, v_current_month, 0, 6000)
  ON CONFLICT (store_id) DO UPDATE
  SET 
    -- Reset if month changed
    used = CASE 
      WHEN discovery_quota.period_start < v_current_month THEN 0 
      ELSE discovery_quota.used 
    END,
    period_start = CASE 
      WHEN discovery_quota.period_start < v_current_month THEN v_current_month 
      ELSE discovery_quota.period_start 
    END,
    updated_at = NOW();
  
  -- Return current quota
  RETURN QUERY
  SELECT 
    dq.store_id,
    dq.period_start,
    dq.used,
    dq.limit_amount,
    (dq.limit_amount - dq.used) as remaining
  FROM public.discovery_quota dq
  WHERE dq.store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume discovery quota
CREATE OR REPLACE FUNCTION consume_discovery_quota(
  p_store_id UUID,
  p_amount INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  remaining INTEGER,
  limit_amount INTEGER,
  used INTEGER
) AS $$
DECLARE
  v_quota RECORD;
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
  -- Get or create quota
  SELECT * INTO v_quota FROM get_or_create_discovery_quota(p_store_id);
  
  -- Reset if month changed
  IF v_quota.period_start < v_current_month THEN
    UPDATE public.discovery_quota
    SET 
      used = 0,
      period_start = v_current_month,
      updated_at = NOW()
    WHERE store_id = p_store_id;
    v_quota.used := 0;
    v_quota.period_start := v_current_month;
  END IF;
  
  -- Check if quota available
  IF (v_quota.used + p_amount) > v_quota.limit_amount THEN
    RETURN QUERY SELECT 
      false as success,
      (v_quota.limit_amount - v_quota.used) as remaining,
      v_quota.limit_amount,
      v_quota.used;
    RETURN;
  END IF;
  
  -- Consume quota
  UPDATE public.discovery_quota
  SET 
    used = used + p_amount,
    updated_at = NOW()
  WHERE store_id = p_store_id;
  
  RETURN QUERY SELECT 
    true as success,
    (v_quota.limit_amount - v_quota.used - p_amount) as remaining,
    v_quota.limit_amount,
    (v_quota.used + p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ENABLE PG_TRGM FOR FUZZY MATCHING
-- ============================================================================
-- Enable pg_trgm extension for similarity matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_competitor_products_updated_at'
  ) THEN
    CREATE TRIGGER update_competitor_products_updated_at
      BEFORE UPDATE ON public.competitor_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_match_candidates_updated_at'
  ) THEN
    CREATE TRIGGER update_match_candidates_updated_at
      BEFORE UPDATE ON public.match_candidates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_competitors_updated_at'
  ) THEN
    CREATE TRIGGER update_product_competitors_updated_at
      BEFORE UPDATE ON public.product_competitors
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_discovery_quota_updated_at'
  ) THEN
    CREATE TRIGGER update_discovery_quota_updated_at
      BEFORE UPDATE ON public.discovery_quota
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

