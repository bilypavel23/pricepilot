-- RPC Function: get_due_competitor_syncs()
-- Returns (store_id, timezone, sync_time) for stores that are due for competitor sync
-- Prevents duplicate syncs within ±2 minute window

CREATE OR REPLACE FUNCTION public.get_due_competitor_syncs()
RETURNS TABLE(store_id uuid, timezone text, sync_time text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_time timestamptz;
BEGIN
  current_time := now();

  RETURN QUERY
  SELECT DISTINCT 
    sss.store_id,
    sss.timezone,
    TO_CHAR(current_time AT TIME ZONE sss.timezone, 'HH24:MI') AS sync_time
  FROM public.store_sync_settings sss
  WHERE sss.sync_enabled = true
    AND EXISTS (
      -- Check if there are any competitor products or URL products to sync
      SELECT 1
      FROM public.competitor_product_matches cpm
      WHERE cpm.store_id = sss.store_id
        AND EXISTS (
          SELECT 1
          FROM public.competitor_products cp
          WHERE cp.id = cpm.competitor_product_id
            AND cp.competitor_url IS NOT NULL
        )
      UNION
      SELECT 1
      FROM public.competitor_url_products cup
      WHERE cup.store_id = sss.store_id
        AND cup.competitor_url IS NOT NULL
    )
    AND (
      -- Check if sync is due based on daily_sync_times (within 5 minute window)
      EXISTS (
        SELECT 1
        FROM unnest(sss.daily_sync_times) AS sync_time_str
        WHERE 
          -- Get current time in store's timezone
          -- Convert sync_time_str to minutes since midnight
          (EXTRACT(HOUR FROM (sync_time_str::TIME)) * 60 + EXTRACT(MINUTE FROM (sync_time_str::TIME))) 
          BETWEEN 
            -- Current time in store's timezone, minus 2 minutes (5 minute window)
            (EXTRACT(HOUR FROM (current_time AT TIME ZONE sss.timezone)) * 60 + EXTRACT(MINUTE FROM (current_time AT TIME ZONE sss.timezone)) - 2)
          AND 
            -- Current time in store's timezone, plus 2 minutes (5 minute window)
            (EXTRACT(HOUR FROM (current_time AT TIME ZONE sss.timezone)) * 60 + EXTRACT(MINUTE FROM (current_time AT TIME ZONE sss.timezone)) + 2)
      )
    )
    -- Ensure we haven't already run a sync for this store in the last 2 minutes
    AND NOT EXISTS (
      SELECT 1
      FROM public.store_sync_runs ssr
      WHERE ssr.store_id = sss.store_id
        -- Check if last sync was within last 2 minutes (in store's timezone)
        AND ssr.last_sync_at >= (current_time AT TIME ZONE sss.timezone - INTERVAL '2 minutes')
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_due_competitor_syncs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_competitor_syncs() TO service_role;

