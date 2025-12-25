-- ============================================================================
-- View: store_products_sync_status_safe
-- ============================================================================
-- Provides safe access to store products sync status with timezone-aware formatting
-- Returns last_sync_local (HH:mm in store timezone) and products_sync_source
-- ============================================================================

CREATE OR REPLACE VIEW public.store_products_sync_status_safe AS
SELECT 
  s.id AS store_id,
  -- Get last sync timestamp converted to store timezone (full timestamp, not just time)
  -- Uses last_products_sync_at from stores table (set by mark_products_sync RPC)
  -- Uses store timezone from store_sync_settings (IANA timezone, DST handled by Postgres)
  -- Returns ISO timestamp string in local timezone for frontend formatting
  CASE 
    WHEN s.last_products_sync_at IS NOT NULL AND sss.timezone IS NOT NULL THEN
      (s.last_products_sync_at AT TIME ZONE sss.timezone)::TEXT
    ELSE NULL
  END AS last_sync_local,
  -- Use products_sync_source from stores table (set by mark_products_sync RPC)
  -- Fallback to platform-based source if not set
  COALESCE(
    s.products_sync_source,
    CASE 
      WHEN s.platform = 'shopify' THEN 'Shopify'
      WHEN s.platform = 'woocommerce' THEN 'WooCommerce'
      WHEN s.platform IS NOT NULL THEN INITCAP(s.platform)
      ELSE 'Manual'
    END
  ) AS products_sync_source,
  -- Also return raw last_products_sync_at for reference (in UTC, but UI should not format this directly)
  s.last_products_sync_at AS last_sync_at_utc
FROM public.stores s
LEFT JOIN public.store_sync_settings sss ON sss.store_id = s.id;

-- Grant SELECT to authenticated users (RLS on underlying tables will enforce access control)
GRANT SELECT ON public.store_products_sync_status_safe TO authenticated;

-- Add comment
COMMENT ON VIEW public.store_products_sync_status_safe IS 
  'Provides store products sync status with last_sync_local (HH:mm in store timezone) and products_sync_source. Use store timezone implicitly from backend.';

