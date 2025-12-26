// Supabase Edge Function: scheduled-competitor-sync
// Runs every 5 minutes via cron
// Refreshes prices for BOTH sources:
//   SOURCE 1: competitor_store_products (store_id, competitor_url, last_price, last_checked_at)
//   SOURCE 2: competitor_url_products (store_id, competitor_url, last_price, last_checked_at)
// Safe for 1000+ users across different timezones
// Price refresh ONLY (no discovery, no Shopify detection)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SCRAPINGBEE_API_KEY = Deno.env.get("SCRAPINGBEE_API_KEY") || "";
const MAX_CONCURRENT_FETCHES_PER_STORE = 5;

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
 * Extract price from HTML using best-effort heuristics
 */
function extractPriceFromHtml(html: string): string | null {
  if (!html || html.length < 100) return null;

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

  return priceText || null;
}

/**
 * Scrape price from URL using ScrapingBee
 */
async function scrapePriceFromUrl(url: string): Promise<ScrapedPrice> {
  if (!SCRAPINGBEE_API_KEY) {
    console.warn(`[sync] No SCRAPINGBEE_API_KEY, skipping ${url}`);
    return { price: null, currency: "USD" };
  }

  try {
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${encodeURIComponent(
      SCRAPINGBEE_API_KEY
    )}&url=${encodeURIComponent(url)}&render_js=false`;

    const res = await fetch(scrapingBeeUrl, {
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!res.ok) {
      console.error(`[sync] ScrapingBee failed for ${url}:`, res.status);
      return { price: null, currency: "USD" };
    }

    const html = await res.text();

    if (!html || html.length < 100) {
      return { price: null, currency: "USD" };
    }

    const priceText = extractPriceFromHtml(html);
    if (!priceText) {
      return { price: null, currency: "USD" };
    }

    return parsePrice(priceText);
  } catch (error) {
    console.error(`[sync] Error scraping ${url}:`, error);
    return { price: null, currency: "USD" };
  }
}

/**
 * Process URLs with concurrency limit (5 parallel fetches per store)
 */
async function processUrlsWithConcurrency<T extends { id: string; competitor_url: string; last_price?: number | null; last_checked_at?: string | null }>(
  urls: T[],
  supabase: any,
  tableName: "competitor_store_products" | "competitor_url_products",
  syncTime: string
): Promise<{ storeProductsUpdated: number; urlProductsUpdated: number }> {
  let storeProductsCount = 0;
  let urlProductsCount = 0;

  // Process URLs in batches of MAX_CONCURRENT_FETCHES_PER_STORE
  for (let i = 0; i < urls.length; i += MAX_CONCURRENT_FETCHES_PER_STORE) {
    const batch = urls.slice(i, i + MAX_CONCURRENT_FETCHES_PER_STORE);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        if (!item.competitor_url) return { storeProducts: 0, urlProducts: 0 };

        try {
          const scraped = await scrapePriceFromUrl(item.competitor_url);

          // Check if price changed or last_checked_at was null
          const priceChanged = item.last_price !== scraped.price;
          const wasNeverChecked = item.last_checked_at === null;
          const shouldCount = priceChanged || wasNeverChecked;

          if (scraped.price !== null) {
            const { error: updateError } = await supabase
              .from(tableName)
              .update({
                last_price: scraped.price,
                last_checked_at: syncTime,
                updated_at: syncTime,
              })
              .eq("id", item.id);

            if (updateError) {
              console.error(
                `[sync] Error updating ${tableName} ${item.id}:`,
                updateError
              );
              return { storeProducts: 0, urlProducts: 0 };
            }

            // Count update based on table type
            if (tableName === "competitor_store_products") {
              return { storeProducts: shouldCount ? 1 : 0, urlProducts: 0 };
            } else {
              return { storeProducts: 0, urlProducts: shouldCount ? 1 : 0 };
            }
          } else {
            // Still update last_checked_at even if price is null
            const wasNeverChecked = item.last_checked_at === null;
            await supabase
              .from(tableName)
              .update({
                last_checked_at: syncTime,
                updated_at: syncTime,
              })
              .eq("id", item.id);

            // Count if was never checked (even if price is null, we checked it)
            if (tableName === "competitor_store_products") {
              return { storeProducts: wasNeverChecked ? 1 : 0, urlProducts: 0 };
            } else {
              return { storeProducts: 0, urlProducts: wasNeverChecked ? 1 : 0 };
            }
          }
        } catch (error) {
          // Never throw hard if one product fails; continue
          console.error(
            `[sync] Error processing ${item.competitor_url}:`,
            error
          );
          return { storeProducts: 0, urlProducts: 0 };
        }
      })
    );

    // Sum up counts from batch
    for (const result of batchResults) {
      storeProductsCount += result.storeProducts;
      urlProductsCount += result.urlProducts;
    }
  }

  return { storeProductsUpdated: storeProductsCount, urlProductsUpdated: urlProductsCount };
}

/**
 * Process a single store
 */
async function processStore(
  storeId: string,
  supabase: any,
  syncTime: string
): Promise<{ storeProductsUpdated: number; urlProductsUpdated: number; error: boolean }> {
  try {
    console.log(`[sync] syncing store ${storeId}`);

    // Fetch competitor store products
    const { data: storeProducts, error: storeProductsError } = await supabase
      .from("competitor_store_products")
      .select("id, competitor_url, last_price, last_checked_at")
      .eq("store_id", storeId)
      .not("competitor_url", "is", null);

    if (storeProductsError) {
      console.error(`[sync] Error fetching competitor_store_products for store ${storeId}:`, storeProductsError);
    }

    // Fetch competitor url products
    const { data: urlProducts, error: urlProductsError } = await supabase
      .from("competitor_url_products")
      .select("id, competitor_url, last_price, last_checked_at")
      .eq("store_id", storeId)
      .not("competitor_url", "is", null);

    if (urlProductsError) {
      console.error(`[sync] Error fetching competitor_url_products for store ${storeId}:`, urlProductsError);
    }

    let storeProductsUpdated = 0;
    let urlProductsUpdated = 0;

    // Call RPC sync_competitor_store_prices
    const r1 = await supabase.rpc("sync_competitor_store_prices", {
      p_store_id: storeId,
    });
    console.log("[sync] store prices synced", { store_id: storeId, result: r1.data });

    // Process store products
    if (storeProducts && storeProducts.length > 0) {
      const result = await processUrlsWithConcurrency(
        storeProducts,
        supabase,
        "competitor_store_products",
        syncTime
      );
      storeProductsUpdated = result.storeProductsUpdated;
    }

    // Call RPC sync_competitor_url_prices
    const r2 = await supabase.rpc("sync_competitor_url_prices", {
      p_store_id: storeId,
    });
    console.log("[sync] url prices synced", { store_id: storeId, result: r2.data });

    // Process URL products
    if (urlProducts && urlProducts.length > 0) {
      const result = await processUrlsWithConcurrency(
        urlProducts,
        supabase,
        "competitor_url_products",
        syncTime
      );
      urlProductsUpdated = result.urlProductsUpdated;
    }

    const totalUpdated = storeProductsUpdated + urlProductsUpdated;

    // Update store_sync_settings
    const { error: updateSettingsError } = await supabase
      .from("store_sync_settings")
      .update({
        updated_at: syncTime,
        last_competitor_sync_at: syncTime,
        last_competitor_sync_status: "success",
        last_competitor_sync_updated_count: totalUpdated,
      })
      .eq("store_id", storeId);

    if (updateSettingsError) {
      console.error(
        `[sync] Error updating store_sync_settings for store ${storeId}:`,
        updateSettingsError
      );
    }

    console.log(`[sync] updated store_products: ${storeProductsUpdated}, url_products: ${urlProductsUpdated}`);
    console.log(`[sync] finished store ${storeId}`);

    return { storeProductsUpdated, urlProductsUpdated, error: false };
  } catch (error) {
    console.error(`[sync] Error processing store ${storeId}:`, error);

    // On error, set status to error
    try {
      await supabase
        .from("store_sync_settings")
        .update({
          last_competitor_sync_status: "error",
        })
        .eq("store_id", storeId);
    } catch (updateError) {
      console.error(`[sync] Error updating sync status to error for store ${storeId}:`, updateError);
    }

    return { storeProductsUpdated: 0, urlProductsUpdated: 0, error: true };
  }
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[sync] started");

    // Call RPC get_due_competitor_syncs to get due stores
    const { data: dueStores, error: rpcError } = await supabase.rpc(
      "get_due_competitor_syncs"
    );

    if (rpcError) {
      console.error("[sync] Error calling get_due_competitor_syncs:", rpcError);
      return new Response(
        JSON.stringify({ error: "Failed to get due stores", details: rpcError }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!dueStores || dueStores.length === 0) {
      console.log("[sync] No stores due for sync");
      return new Response(
        JSON.stringify({ message: "No stores due for sync", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync] due stores: ${dueStores.length}`);

    const syncTime = new Date().toISOString();

    // Process each store sequentially (stores are already filtered by RPC)
    for (const store of dueStores) {
      const storeId = store.store_id || store.id;
      if (!storeId) {
        console.warn("[sync] Store missing store_id, skipping");
        continue;
      }

      await processStore(storeId, supabase, syncTime);
    }

    return new Response(
      JSON.stringify({
        message: "Competitor sync completed",
        storesProcessed: dueStores.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
