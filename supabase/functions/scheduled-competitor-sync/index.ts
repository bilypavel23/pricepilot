// Supabase Edge Function: scheduled-competitor-sync
// Runs every 5 minutes via cron
// Refreshes prices for BOTH sources:
//   SOURCE 1: competitor_product_matches → competitor_products (via competitor_product_id)
//   SOURCE 2: competitor_url_products (direct)
// Safe for 1000+ users across different timezones
// Price refresh ONLY (no discovery, no Shopify detection)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SCRAPINGBEE_API_KEY = Deno.env.get("SCRAPINGBEE_API_KEY") || "";
const MAX_CONCURRENT_STORES = 5;
const URL_BATCH_SIZE = 25;
const MAX_RETRIES = 2;

interface ScrapedPrice {
  price: number | null;
  currency: string;
}

/**
 * Parse price from HTML text
 */
function parsePrice(priceText: string): { price: number | null; currency: string } {
  if (!priceText) return { price: null, currency: "USD" };

  // Detect currency
  let currency = "USD";
  if (priceText.includes("$")) currency = "USD";
  else if (priceText.includes("£")) currency = "GBP";
  else if (priceText.includes("€")) currency = "EUR";

  // Extract number
  const cleaned = priceText
    .replace(/[^\d.,-]+/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) return { price: null, currency };

  // Handle decimal separators
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const n = Number(normalized);
  return { price: Number.isNaN(n) ? null : n, currency };
}

/**
 * Scrape price from a single product URL with retry logic
 */
async function scrapePriceFromUrl(
  url: string,
  retries: number = MAX_RETRIES
): Promise<ScrapedPrice> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let html: string | null = null;

      // Try direct fetch first
      try {
        const directRes = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (directRes.ok) {
          html = await directRes.text();
        }
      } catch (e) {
        if (attempt < retries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        console.warn(`[sync] Direct fetch failed for ${url} (attempt ${attempt + 1}):`, e);
      }

      // Fallback to ScrapingBee if direct fetch failed or returned empty
      // Fetch strategy: cheap first (direct fetch), ScrapingBee fallback
      if (!html || html.length < 500) {
        if (!SCRAPINGBEE_API_KEY) {
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          console.warn("[sync] No SCRAPINGBEE_API_KEY, skipping ScrapingBee");
          return { price: null, currency: "USD" };
        }

        // Fallback to ScrapingBee using secret from Deno.env.get
        // Fetch rendered HTML and parse price
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${encodeURIComponent(
          SCRAPINGBEE_API_KEY
        )}&url=${encodeURIComponent(url)}&render_js=false`;

        try {
          const res = await fetch(scrapingBeeUrl, {
            signal: AbortSignal.timeout(15000), // 15s timeout
          });

          if (!res.ok) {
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
            console.error(`[sync] ScrapingBee failed for ${url}:`, res.status);
            return { price: null, currency: "USD" };
          }

          html = await res.text();
        } catch (e) {
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          console.error(`[sync] ScrapingBee error for ${url}:`, e);
          return { price: null, currency: "USD" };
        }
      }

      if (!html) {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        return { price: null, currency: "USD" };
      }

      // Parse price from HTML using common selectors
      let priceText = "";

      // Pattern 1: Look for elements with price-related classes
      const priceClassPattern = /<[^>]*class="[^"]*(?:price|product-price|money|amount|current-price)[^"]*"[^>]*>([^<]+)<\/[^>]*>/gi;
      let match = priceClassPattern.exec(html);
      if (match && match[1]) {
        priceText = match[1].trim();
      }

      // Pattern 2: Look for data-price attributes
      if (!priceText) {
        const dataPricePattern = /<[^>]*data-price="([^"]+)"[^>]*>/gi;
        match = dataPricePattern.exec(html);
        if (match && match[1]) {
          priceText = match[1].trim();
        }
      }

      // Pattern 3: Look for data-product-price attributes
      if (!priceText) {
        const dataProductPricePattern = /<[^>]*data-product-price="([^"]+)"[^>]*>/gi;
        match = dataProductPricePattern.exec(html);
        if (match && match[1]) {
          priceText = match[1].trim();
        }
      }

      // Pattern 4: Look for currency symbols followed by numbers
      if (!priceText) {
        const currencyPattern = /[$£€]\s*(\d+[\d,.]*)/g;
        match = currencyPattern.exec(html);
        if (match && match[0]) {
          priceText = match[0].trim();
        }
      }

      // Pattern 5: Look for price-like text anywhere (fallback)
      if (!priceText) {
        const fallbackPattern = /(?:price|cost|amount)[\s:]*[$£€]?\s*(\d+[\d,.]*)/i;
        match = fallbackPattern.exec(html);
        if (match && match[0]) {
          priceText = match[0].trim();
        }
      }

      if (!priceText) {
        return { price: null, currency: "USD" };
      }

      return parsePrice(priceText);
    } catch (error) {
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      console.error(`[sync] Error scraping ${url} (final attempt):`, error);
      return { price: null, currency: "USD" };
    }
  }

  return { price: null, currency: "USD" };
}

/**
 * Process a batch of URLs with concurrency control
 */
async function processUrlBatch<T extends { id: string; competitor_url: string }>(
  urls: T[],
  supabase: any,
  tableName: "competitor_products" | "competitor_url_products",
  syncTime: string
): Promise<number> {
  let processed = 0;

  // Process URLs in batches to avoid timeouts
  for (let i = 0; i < urls.length; i += URL_BATCH_SIZE) {
    const batch = urls.slice(i, i + URL_BATCH_SIZE);
    const batchPromises = batch.map(async (item) => {
      if (!item.competitor_url) return;

      try {
        const scraped = await scrapePriceFromUrl(item.competitor_url);

        if (scraped.price !== null) {
          const { error: updateError } = await supabase
            .from(tableName)
            .update({
              last_price: scraped.price,
              last_checked_at: syncTime,
            })
            .eq("id", item.id);

          if (updateError) {
            console.error(
              `[sync] Error updating ${tableName} ${item.id}:`,
              updateError
            );
          } else {
            processed++;
          }
        } else {
          // Still update last_checked_at even if price is null
          await supabase
            .from(tableName)
            .update({
              last_checked_at: syncTime,
            })
            .eq("id", item.id);
        }
      } catch (error) {
        console.error(
          `[sync] Error processing ${item.competitor_url}:`,
          error
        );
        // Continue with next URL (non-fatal)
      }
    });

    // Wait for batch to complete before starting next batch
    await Promise.all(batchPromises);
  }

  return processed;
}

/**
 * Process a single store
 */
async function processStore(
  storeId: string,
  syncTimeSlot: string,
  supabase: any,
  syncTime: string
): Promise<{ processed: number; error: boolean }> {
  try {
    let totalProcessed = 0;

    // A) SOURCE 1: Scrape competitor store products
    // Read competitor_product_matches rows for store_id
    const { data: matches, error: matchesError } = await supabase
      .from("competitor_product_matches")
      .select("competitor_product_id")
      .eq("store_id", storeId)
      .not("competitor_product_id", "is", null);

    if (matchesError) {
      console.error(`[sync] Error fetching matches for store ${storeId}:`, matchesError);
      // Continue to SOURCE 2 even if SOURCE 1 fails
    } else {
      // Collect competitor_product_id list
      const competitorProductIds = [
        ...new Set(
          matches
            ?.map((m: any) => m.competitor_product_id)
            .filter((id: any): id is string => id !== null) || []
        ),
      ];

      // Fetch competitor_products by id to get competitor_url and current last_price
      if (competitorProductIds.length > 0) {
        const { data: competitorProducts, error: productsError } = await supabase
          .from("competitor_products")
          .select("id, competitor_url, last_price, last_checked_at")
          .in("id", competitorProductIds)
          .not("competitor_url", "is", null);

        if (productsError) {
          console.error(
            `[sync] Error fetching competitor_products for store ${storeId}:`,
            productsError
          );
          // Continue to SOURCE 2 even if SOURCE 1 fails
        } else if (competitorProducts && competitorProducts.length > 0) {
          // For each competitor_url scraped, update competitor_products
          const processed = await processUrlBatch(
            competitorProducts,
            supabase,
            "competitor_products",
            syncTime
          );
          totalProcessed += processed;
        }
      }
    }

    // B) SOURCE 2: Scrape competitor_url_products
    // Read competitor_url_products rows for store_id (id, competitor_url, last_price)
    const { data: urlProducts, error: urlProductsError } = await supabase
      .from("competitor_url_products")
      .select("id, competitor_url, last_price, last_checked_at")
      .eq("store_id", storeId)
      .not("competitor_url", "is", null);

    if (urlProductsError) {
      console.error(
        `[sync] Error fetching url_products for store ${storeId}:`,
        urlProductsError
      );
      // Continue to finalization even if SOURCE 2 fails
    } else if (urlProducts && urlProducts.length > 0) {
      // For each competitor_url scraped, update competitor_url_products
      const processed = await processUrlBatch(
        urlProducts,
        supabase,
        "competitor_url_products",
        syncTime
      );
      totalProcessed += processed;
    }

    // C) After finishing BOTH A and B (even if some URLs failed):
    // Update store_sync_settings.updated_at
    const { error: updateSettingsError } = await supabase
      .from("store_sync_settings")
      .update({
        updated_at: syncTime,
      })
      .eq("store_id", storeId);

    if (updateSettingsError) {
      console.error(
        `[sync] Error updating store_sync_settings for store ${storeId}:`,
        updateSettingsError
      );
    }

    // Call RPC mark_competitor_sync_run(storeId, sync_time) to prevent repeating the same slot/day
    const { error: markError } = await supabase.rpc("mark_competitor_sync_run", {
      p_store_id: storeId,
      p_sync_time: syncTimeSlot,
    });

    if (markError) {
      console.error(
        `[sync] Error calling mark_competitor_sync_run for store ${storeId}:`,
        markError
      );
    }

    // Logging: console.log(`[sync] finished store ${storeId} slot ${syncTimeSlot} (stores+urls)`)
    console.log(`[sync] finished store ${storeId} slot ${syncTimeSlot} (stores+urls)`);

    return { processed: totalProcessed, error: false };
  } catch (error) {
    console.error(`[sync] Error processing store ${storeId}:`, error);
    return { processed: 0, error: true };
  }
}

/**
 * Process stores with limited concurrency
 */
async function processStoresWithConcurrency(
  stores: Array<{ store_id?: string; id?: string; timezone?: string; sync_time?: string }>,
  supabase: any,
  syncTime: string
): Promise<{ totalProcessed: number; totalErrors: number }> {
  let totalProcessed = 0;
  let totalErrors = 0;

  // Process stores in batches of MAX_CONCURRENT_STORES
  for (let i = 0; i < stores.length; i += MAX_CONCURRENT_STORES) {
    const batch = stores.slice(i, i + MAX_CONCURRENT_STORES);

    const batchPromises = batch.map(async (store) => {
      const storeId = store.store_id || store.id;
      const syncTimeSlot = store.sync_time || new Date().toISOString().slice(11, 16);
      
      if (!storeId) {
        console.warn("[sync] Store missing store_id, skipping");
        return { processed: 0, error: true };
      }

      return await processStore(storeId, syncTimeSlot, supabase, syncTime);
    });

    const results = await Promise.all(batchPromises);

    for (const result of results) {
      totalProcessed += result.processed;
      if (result.error) {
        totalErrors++;
      }
    }
  }

  return { totalProcessed, totalErrors };
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[sync] Starting scheduled competitor sync");

    // 1. Call RPC get_due_competitor_syncs()
    const { data: dueStores, error: rpcError } = await supabase.rpc(
      "get_due_competitor_syncs"
    );

    if (rpcError) {
      console.error("[sync] Error calling get_due_competitor_syncs:", rpcError);
      return new Response(
        JSON.stringify({ error: "Failed to get due stores", details: rpcError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!dueStores || dueStores.length === 0) {
      console.log("[sync] No stores due for sync");
      return new Response(
        JSON.stringify({ message: "No stores due for sync", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync] Found ${dueStores.length} stores due for sync`);

    const syncTime = new Date().toISOString();

    // 2. Process stores with limited concurrency
    const { totalProcessed, totalErrors } = await processStoresWithConcurrency(
      dueStores,
      supabase,
      syncTime
    );

    console.log(
      `[sync] Completed. Processed: ${totalProcessed}, Errors: ${totalErrors}`
    );

    return new Response(
      JSON.stringify({
        message: "Competitor sync completed",
        storesProcessed: dueStores.length,
        pricesUpdated: totalProcessed,
        errors: totalErrors,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
