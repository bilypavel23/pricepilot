-- ============================================================================
-- Store Sync Runs Tracking
-- ============================================================================
-- Tracks daily sync runs per store for plan-based limit enforcement.
-- Resets automatically each day (new row per date).

CREATE TABLE IF NOT EXISTS public.store_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  
  -- Date of the sync runs (YYYY-MM-DD)
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Count of sync runs on this date
  sync_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamp of last sync
  last_sync_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per store per day
  UNIQUE (store_id, run_date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ssr_store_date ON public.store_sync_runs(store_id, run_date);

-- RLS policies
ALTER TABLE public.store_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own store sync runs"
  ON public.store_sync_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_sync_runs.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own store sync runs"
  ON public.store_sync_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_sync_runs.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own store sync runs"
  ON public.store_sync_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_sync_runs.store_id
      AND stores.owner_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_store_sync_runs_updated_at
  BEFORE UPDATE ON public.store_sync_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

