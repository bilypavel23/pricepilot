-- RPC Function: mark_competitor_sync_run(store_id, sync_time)
-- Records that a competitor sync run was completed for a store
-- Uses store's timezone from store_sync_settings for run_date calculation
-- Prevents duplicate syncs within ±2 minute window

CREATE OR REPLACE FUNCTION public.mark_competitor_sync_run(
  p_store_id UUID,
  p_sync_time TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  run_date_val DATE;
  store_timezone TEXT;
BEGIN
  -- Get store's timezone from store_sync_settings (must exist, no fallback)
  SELECT timezone INTO store_timezone
  FROM public.store_sync_settings
  WHERE store_id = p_store_id;
  
  -- If timezone not found, raise error (should not happen - get_due_competitor_syncs only returns stores with settings)
  IF store_timezone IS NULL THEN
    RAISE EXCEPTION 'store_sync_settings not found for store_id: %', p_store_id;
  END IF;
  
  -- Calculate run_date in store's timezone (IANA timezone, DST handled by Postgres)
  run_date_val := (NOW() AT TIME ZONE store_timezone)::DATE;
  
  -- Upsert sync run record (reuse store_sync_runs table)
  INSERT INTO public.store_sync_runs (
    store_id,
    run_date,
    sync_count,
    last_sync_at
  )
  VALUES (
    p_store_id,
    run_date_val,
    1,
    NOW()
  )
  ON CONFLICT (store_id, run_date)
  DO UPDATE SET
    sync_count = store_sync_runs.sync_count + 1,
    last_sync_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_competitor_sync_run(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_competitor_sync_run(UUID, TEXT) TO service_role;

