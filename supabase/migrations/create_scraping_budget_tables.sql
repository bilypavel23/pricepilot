-- ============================================================================
-- Cost-Safe Competitor Price Scraping - Database Schema
-- ============================================================================
-- This migration creates tables for:
-- 1. competitor_product_links: Tracks individual competitor product URLs with
--    price history, change streaks, and scheduling metadata
-- 2. user_scrape_budget: Tracks daily/monthly scraping request usage per user
-- 3. scrape_jobs: Queue for batch scraping jobs
-- ============================================================================

-- ============================================================================
-- 1. COMPETITOR PRODUCT LINKS TABLE
-- ============================================================================
-- Stores the relationship between our products and competitor product URLs
-- with tracking metadata for smart skipping and retry logic.

CREATE TABLE IF NOT EXISTS public.competitor_product_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  
  -- The competitor product URL to scrape (the main tracking target)
  competitor_product_url TEXT NOT NULL,
  
  -- Optional: link to competitor_products table if we have detailed product info
  competitor_product_id UUID REFERENCES public.competitor_products(id) ON DELETE SET NULL,
  
  -- Price tracking
  last_price NUMERIC(12, 2),
  last_currency TEXT DEFAULT 'USD',
  last_availability BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Smart skipping: consecutive checks with no price change
  no_change_streak INTEGER NOT NULL DEFAULT 0,
  
  -- Error handling: consecutive failed scrape attempts
  error_streak INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT,
  
  -- Scheduling: when this URL can next be checked (for skipping/retry backoff)
  next_allowed_check_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Priority (higher = check first)
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Unique constraint: one link per product-competitor pair
  UNIQUE (product_id, competitor_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cpl_user_id ON public.competitor_product_links(user_id);
CREATE INDEX IF NOT EXISTS idx_cpl_store_id ON public.competitor_product_links(store_id);
CREATE INDEX IF NOT EXISTS idx_cpl_product_id ON public.competitor_product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_cpl_competitor_id ON public.competitor_product_links(competitor_id);
CREATE INDEX IF NOT EXISTS idx_cpl_is_active ON public.competitor_product_links(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cpl_next_check ON public.competitor_product_links(next_allowed_check_at) 
  WHERE is_active = TRUE AND competitor_product_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cpl_last_checked ON public.competitor_product_links(last_checked_at NULLS FIRST);

-- RLS policies
ALTER TABLE public.competitor_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own competitor product links"
  ON public.competitor_product_links FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own competitor product links"
  ON public.competitor_product_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own competitor product links"
  ON public.competitor_product_links FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own competitor product links"
  ON public.competitor_product_links FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 2. USER SCRAPE BUDGET TABLE
-- ============================================================================
-- Tracks scraping request usage per user to enforce cost caps.
-- Resets daily and monthly.

CREATE TABLE IF NOT EXISTS public.user_scrape_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Monthly tracking
  period_start DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  requests_used_month INTEGER NOT NULL DEFAULT 0,
  
  -- Daily tracking
  requests_today_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requests_used_today INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_usb_user_id ON public.user_scrape_budget(user_id);

-- RLS policies
ALTER TABLE public.user_scrape_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scrape budget"
  ON public.user_scrape_budget FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own scrape budget"
  ON public.user_scrape_budget FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own scrape budget"
  ON public.user_scrape_budget FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. SCRAPE JOBS TABLE (Queue)
-- ============================================================================
-- Queue for batch scraping jobs. Used for heavy matching and deferred work.

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  
  -- Job type: 'tracking' | 'matching' | 'quick_start_matching'
  job_type TEXT NOT NULL,
  
  -- Job status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'deferred'
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Optional: specific competitor for matching jobs
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,
  
  -- Batch info
  batch_number INTEGER NOT NULL DEFAULT 1,
  total_batches INTEGER NOT NULL DEFAULT 1,
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_total INTEGER NOT NULL DEFAULT 0,
  
  -- Progress tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error info
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sj_user_id ON public.scrape_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sj_status ON public.scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sj_scheduled ON public.scrape_jobs(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sj_job_type ON public.scrape_jobs(job_type);

-- RLS policies
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scrape jobs"
  ON public.scrape_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own scrape jobs"
  ON public.scrape_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own scrape jobs"
  ON public.scrape_jobs FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. MATCHING RATE LIMIT TABLE
-- ============================================================================
-- Tracks heavy matching runs per user per day to enforce 1/day limit.

CREATE TABLE IF NOT EXISTS public.user_matching_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Date of the matching run
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Count of heavy matching runs on this date
  heavy_matching_count INTEGER NOT NULL DEFAULT 0,
  
  -- Count of competitor stores added on this date
  competitor_stores_added INTEGER NOT NULL DEFAULT 0,
  
  -- Count of URLs added on this date
  urls_added INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per user per day
  UNIQUE (user_id, run_date)
);

-- RLS policies
ALTER TABLE public.user_matching_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matching rate limit"
  ON public.user_matching_rate_limit FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own matching rate limit"
  ON public.user_matching_rate_limit FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own matching rate limit"
  ON public.user_matching_rate_limit FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. PRICE HISTORY TABLE (Optional - for analytics)
-- ============================================================================
-- Stores historical price data for competitor products.

CREATE TABLE IF NOT EXISTS public.competitor_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_product_link_id UUID NOT NULL REFERENCES public.competitor_product_links(id) ON DELETE CASCADE,
  
  price NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  availability BOOLEAN DEFAULT TRUE,
  
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_cph_link_id ON public.competitor_price_history(competitor_product_link_id);
CREATE INDEX IF NOT EXISTS idx_cph_recorded_at ON public.competitor_price_history(recorded_at DESC);

-- RLS policies (inherit from parent link)
ALTER TABLE public.competitor_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own price history"
  ON public.competitor_price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitor_product_links cpl
      WHERE cpl.id = competitor_product_link_id
      AND cpl.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own price history"
  ON public.competitor_price_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitor_product_links cpl
      WHERE cpl.id = competitor_product_link_id
      AND cpl.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to reset daily budget counters
CREATE OR REPLACE FUNCTION reset_daily_scrape_budget()
RETURNS void AS $$
BEGIN
  UPDATE public.user_scrape_budget
  SET 
    requests_used_today = 0,
    requests_today_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE requests_today_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly budget counters
CREATE OR REPLACE FUNCTION reset_monthly_scrape_budget()
RETURNS void AS $$
BEGIN
  UPDATE public.user_scrape_budget
  SET 
    requests_used_month = 0,
    period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE,
    updated_at = NOW()
  WHERE period_start < DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment scrape budget usage
CREATE OR REPLACE FUNCTION increment_scrape_budget(
  p_user_id UUID,
  p_request_count INTEGER DEFAULT 1
)
RETURNS TABLE (
  daily_remaining INTEGER,
  monthly_remaining INTEGER,
  budget_exceeded BOOLEAN
) AS $$
DECLARE
  v_max_daily INTEGER := 666;  -- Default, should be passed from app config
  v_max_monthly INTEGER := 20000;  -- Default, should be passed from app config
  v_current_daily INTEGER;
  v_current_monthly INTEGER;
BEGIN
  -- Ensure user has a budget record
  INSERT INTO public.user_scrape_budget (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Reset if needed
  UPDATE public.user_scrape_budget
  SET 
    requests_used_today = CASE WHEN requests_today_date < CURRENT_DATE THEN 0 ELSE requests_used_today END,
    requests_today_date = CURRENT_DATE,
    requests_used_month = CASE WHEN period_start < DATE_TRUNC('month', CURRENT_DATE)::DATE THEN 0 ELSE requests_used_month END,
    period_start = CASE WHEN period_start < DATE_TRUNC('month', CURRENT_DATE)::DATE THEN DATE_TRUNC('month', CURRENT_DATE)::DATE ELSE period_start END
  WHERE user_id = p_user_id;
  
  -- Increment and return
  UPDATE public.user_scrape_budget
  SET 
    requests_used_today = requests_used_today + p_request_count,
    requests_used_month = requests_used_month + p_request_count,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING 
    v_max_daily - requests_used_today,
    v_max_monthly - requests_used_month,
    (requests_used_today > v_max_daily OR requests_used_month > v_max_monthly)
  INTO daily_remaining, monthly_remaining, budget_exceeded;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_competitor_product_links_updated_at
  BEFORE UPDATE ON public.competitor_product_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_scrape_budget_updated_at
  BEFORE UPDATE ON public.user_scrape_budget
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scrape_jobs_updated_at
  BEFORE UPDATE ON public.scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_matching_rate_limit_updated_at
  BEFORE UPDATE ON public.user_matching_rate_limit
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


