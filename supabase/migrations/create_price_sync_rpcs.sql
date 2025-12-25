-- ============================================================================
-- RPC Functions for Scheduled Price Sync
-- ============================================================================
-- These functions support the scheduled-price-sync Edge Function
-- ============================================================================

-- Function: get_due_store_syncs()
-- Returns stores that are due for price sync based on store_sync_settings
-- Uses IANA timezone from store_sync_settings.timezone for all time comparisons
CREATE OR REPLACE FUNCTION public.get_due_store_syncs()
RETURNS TABLE(store_id UUID, sync_time TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return stores where:
  -- 1. sync_settings exists
  -- 2. current time in store's timezone matches one of the daily_sync_times (within 5 minute window)
  -- 3. No sync run exists for this store today at this sync_time
  RETURN QUERY
  SELECT DISTINCT
    sss.store_id,
    TO_CHAR(NOW() AT TIME ZONE sss.timezone, 'HH24:MI') AS sync_time
  FROM public.store_sync_settings sss
  WHERE EXISTS (
    -- Check if current time in store's timezone matches any sync time (within 5 minute window)
    SELECT 1
    FROM unnest(sss.daily_sync_times) AS sync_time_str
    WHERE 
      -- Get current time in store's timezone
      -- Convert sync_time_str to minutes since midnight
      (EXTRACT(HOUR FROM (sync_time_str::TIME)) * 60 + EXTRACT(MINUTE FROM (sync_time_str::TIME))) 
      BETWEEN 
        -- Current time in store's timezone, minus 2 minutes (5 minute window)
        (EXTRACT(HOUR FROM (NOW() AT TIME ZONE sss.timezone)) * 60 + EXTRACT(MINUTE FROM (NOW() AT TIME ZONE sss.timezone)) - 2)
      AND 
        -- Current time in store's timezone, plus 2 minutes (5 minute window)
        (EXTRACT(HOUR FROM (NOW() AT TIME ZONE sss.timezone)) * 60 + EXTRACT(MINUTE FROM (NOW() AT TIME ZONE sss.timezone)) + 2)
  )
  -- Ensure we haven't already run a sync for this store today at this time
  -- Use store's timezone for date comparison as well
  AND NOT EXISTS (
    SELECT 1
    FROM public.store_sync_runs ssr
    WHERE ssr.store_id = sss.store_id
      -- Compare dates in store's timezone
      AND ssr.run_date = (NOW() AT TIME ZONE sss.timezone)::DATE
      -- Check if last sync was within last 10 minutes (in store's timezone)
      AND ssr.last_sync_at >= (NOW() AT TIME ZONE sss.timezone - INTERVAL '10 minutes')
  );
END;
$$;

-- Function: mark_store_sync_run(store_id, sync_time)
-- Records that a sync run was completed for a store
-- Uses store's timezone from store_sync_settings for run_date calculation
CREATE OR REPLACE FUNCTION public.mark_store_sync_run(
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
  
  -- If timezone not found, raise error (should not happen - get_due_store_syncs only returns stores with settings)
  IF store_timezone IS NULL THEN
    RAISE EXCEPTION 'store_sync_settings not found for store_id: %', p_store_id;
  END IF;
  
  -- Calculate run_date in store's timezone (IANA timezone, DST handled by Postgres)
  run_date_val := (NOW() AT TIME ZONE store_timezone)::DATE;
  
  -- Upsert sync run record
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

-- Function: touch_store_sync_settings(store_id)
-- Updates the updated_at timestamp for store_sync_settings
CREATE OR REPLACE FUNCTION public.touch_store_sync_settings(
  p_store_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.store_sync_settings
  SET updated_at = NOW()
  WHERE store_id = p_store_id;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_due_store_syncs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_store_syncs() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_store_sync_run(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_store_sync_run(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_store_sync_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_store_sync_settings(UUID) TO service_role;

