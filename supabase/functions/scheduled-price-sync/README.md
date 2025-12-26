# Scheduled Price Sync Edge Function

This Edge Function runs every 5 minutes via Supabase cron to scrape competitor prices and update the database.

## Setup

1. **Deploy the function:**
   ```bash
   supabase functions deploy scheduled-price-sync
   ```

2. **Set environment variables:**
   ```bash
   supabase secrets set SCRAPINGBEE_API_KEY=your_api_key_here
   ```

3. **Create the cron job in Supabase Dashboard:**
   - Go to Database → Cron Jobs
   - Create a new cron job:
     - **Name:** `scheduled-price-sync`
     - **Schedule:** `*/5 * * * *` (every 5 minutes)
     - **Command:** 
       ```sql
       SELECT net.http_post(
         url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduled-price-sync',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
         ),
         body := '{}'::jsonb
       );
       ```

## How it works

1. Calls `get_due_store_syncs()` RPC to get stores that are due for sync
2. For each store:
   - Fetches competitor URLs from `competitor_product_matches`
   - Scrapes prices and updates `last_price` and `last_checked_at`
   - Fetches competitor URLs from `competitor_url_products`
   - Scrapes prices and updates `last_price` and `last_checked_at`
3. Calls `mark_store_sync_run()` and `touch_store_sync_settings()` after processing

## Requirements

- RPC functions must be created (see `supabase/migrations/create_price_sync_rpcs.sql`)
- `store_sync_settings` table must exist
- `store_sync_runs` table must exist
- `competitor_product_matches` table must have `last_price` and `last_checked_at` columns
- `competitor_url_products` table must have `last_price` and `last_checked_at` columns


