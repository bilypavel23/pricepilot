# scheduled-competitor-sync

Supabase Edge Function that runs every 5 minutes via cron to scrape competitor prices.
Safe for 1000+ users across different timezones.

## Behavior

1. Calls `get_due_competitor_syncs()` RPC to get stores that are due for sync
2. Processes stores with limited concurrency (max 5 stores at a time)
3. For each store:
   - **A) Scrape competitor store products:**
     - Query `competitor_product_matches` where `store_id = storeId`
     - Join `competitor_products` on `competitor_product_id` to get `competitor_url`
     - For each `competitor_url`: scrape price only
     - Update `competitor_products`: `last_price = price`, `last_checked_at = now()`
   - **B) Scrape competitor_url_products:**
     - Query `competitor_url_products` where `store_id = storeId`
     - For each `competitor_url`: scrape price only
     - Update `competitor_url_products`: `last_price = price`, `last_checked_at = now()`
   - **C) After finishing A+B:**
     - Update `store_sync_settings.updated_at = now()` where `store_id = storeId`
     - Call RPC `mark_competitor_sync_run(storeId, sync_time)` to prevent duplicate syncs in ±2min window
   - **D) Logging:**
     - `console.log("[sync] finished store", storeId, "slot", sync_time)`

## Features

- **Concurrency Control**: Max 5 stores processed concurrently to avoid overwhelming the system
- **URL Batching**: Processes URLs in batches of 25 to avoid timeouts
- **Retry Logic**: Max 2 retries per URL on transient errors with exponential backoff
- **Timezone Safe**: Uses store timezone from `store_sync_settings` for all time comparisons
- **Duplicate Prevention**: Uses `mark_competitor_sync_run` RPC to prevent duplicate syncs within ±2 minute window

## Cron Schedule

Runs every 5 minutes: `*/5 * * * *`

## Environment Variables

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access
- `SCRAPINGBEE_API_KEY`: (Optional) ScrapingBee API key for fallback scraping

## Rules

- Does NOT insert new rows
- Only updates:
  - `competitor_products.last_price`
  - `competitor_products.last_checked_at`
  - `competitor_url_products.last_price`
  - `competitor_url_products.last_checked_at`
  - `store_sync_settings.updated_at`
- Scrapes only price (ignores name, currency, raw, etc.)
- Continues on single URL failure (non-fatal)
- Does NOT block other stores if one store fails (non-fatal)
- Processes URLs in batches of 25 to avoid timeouts
- Retries failed URLs up to 2 times with exponential backoff

