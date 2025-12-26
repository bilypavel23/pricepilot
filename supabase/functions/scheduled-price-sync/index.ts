// Supabase Edge Function: scheduled-price-sync
// Runs every 5 minutes via cron
// Scrapes competitor prices and updates last_price and last_checked_at

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SCRAPINGBEE_API_KEY = Deno.env.get("SCRAPINGBEE_API_KEY") || "";

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
 * Scrape price from a single product URL
 */
async function scrapePriceFromUrl(url: string): Promise<ScrapedPrice> {
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
      console.warn(`[price-sync] Direct fetch failed for ${url}:`, e);
    }

    // Fallback to ScrapingBee if direct fetch failed or returned empty
    if (!html || html.length < 500) {
      if (!SCRAPINGBEE_API_KEY) {
        console.warn("[price-sync] No SCRAPINGBEE_API_KEY, skipping ScrapingBee");
        return { price: null, currency: "USD" };
      }

      const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${encodeURIComponent(
        SCRAPINGBEE_API_KEY
      )}&url=${encodeURIComponent(url)}&render_js=false`;

      const res = await fetch(scrapingBeeUrl, {
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!res.ok) {
        console.error(`[price-sync] ScrapingBee failed for ${url}:`, res.status);
        return { price: null, currency: "USD" };
      }

      html = await res.text();
    }

    if (!html) {
      return { price: null, currency: "USD" };
    }

    // Parse price from HTML using common selectors
    // Simple regex-based extraction (no cheerio in Edge Functions)
    // Try to extract text content from price-related elements
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
    console.error(`[price-sync] Error scraping ${url}:`, error);
    return { price: null, currency: "USD" };
  }
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[price-sync] Starting scheduled price sync");

    // 1. Call RPC get_due_store_syncs()
    const { data: dueStores, error: rpcError } = await supabase.rpc(
      "get_due_store_syncs"
    );

    if (rpcError) {
      console.error("[price-sync] Error calling get_due_store_syncs:", rpcError);
      return new Response(
        JSON.stringify({ error: "Failed to get due stores", details: rpcError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!dueStores || dueStores.length === 0) {
      console.log("[price-sync] No stores due for sync");
      return new Response(
        JSON.stringify({ message: "No stores due for sync", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[price-sync] Found ${dueStores.length} stores due for sync`);

    const syncTime = new Date().toISOString();
    let totalProcessed = 0;
    let totalErrors = 0;

    // 2. Process each store
    for (const store of dueStores) {
      const storeId = store.store_id || store.id;
      if (!storeId) {
        console.warn("[price-sync] Store missing store_id, skipping");
        continue;
      }

      console.log(`[price-sync] Processing store_id: ${storeId}`);

      let storeUpdatedCount = 0;
      let storeFatalError = false;

      try {
        // 2a. Fetch competitor URLs from competitor_product_matches
        const { data: matches, error: matchesError } = await supabase
          .from("competitor_product_matches")
          .select("id, competitor_url, last_price, last_checked_at")
          .eq("store_id", storeId)
          .not("competitor_url", "is", null);

        if (matchesError) {
          console.error(
            `[price-sync] Error fetching matches for store ${storeId}:`,
            matchesError
          );
          storeFatalError = true;
          totalErrors++;
          // Mark as failed and continue
          try {
            await supabase.rpc("mark_competitor_sync_result", {
              p_store_id: storeId,
              p_status: "failed",
              p_updated_count: storeUpdatedCount,
            });
          } catch (rpcError) {
            console.error(`[price-sync] Error calling mark_competitor_sync_result:`, rpcError);
          }
          continue;
        }

        // Scrape and update competitor_product_matches
        if (matches && matches.length > 0) {
          console.log(
            `[price-sync] Found ${matches.length} competitor_product_matches for store ${storeId}`
          );

          for (const match of matches) {
            if (!match.competitor_url) continue;

            try {
              const scraped = await scrapePriceFromUrl(match.competitor_url);

              if (scraped.price !== null) {
                // Check if price changed or last_checked_at was null
                const priceChanged = match.last_price !== scraped.price;
                const wasNeverChecked = match.last_checked_at === null;

                const { error: updateError } = await supabase
                  .from("competitor_product_matches")
                  .update({
                    last_price: scraped.price,
                    last_checked_at: syncTime,
                  })
                  .eq("id", match.id);

                if (updateError) {
                  console.error(
                    `[price-sync] Error updating match ${match.id}:`,
                    updateError
                  );
                } else {
                  totalProcessed++;
                  // Increment updatedCount if price changed or was never checked
                  if (priceChanged || wasNeverChecked) {
                    storeUpdatedCount++;
                  }
                }
              } else {
                // Still update last_checked_at even if price is null
                const wasNeverChecked = match.last_checked_at === null;
                await supabase
                  .from("competitor_product_matches")
                  .update({
                    last_checked_at: syncTime,
                  })
                  .eq("id", match.id);
                // Increment if was never checked (even if price is null, we checked it)
                if (wasNeverChecked) {
                  storeUpdatedCount++;
                }
              }
            } catch (error) {
              console.error(
                `[price-sync] Error scraping ${match.competitor_url}:`,
                error
              );
              // Continue with next URL (non-fatal)
            }
          }
        }

        // 2b. Fetch competitor URLs from competitor_url_products
        const { data: urlProducts, error: urlProductsError } = await supabase
          .from("competitor_url_products")
          .select("id, competitor_url, last_price, last_checked_at")
          .eq("store_id", storeId)
          .not("competitor_url", "is", null);

        if (urlProductsError) {
          console.error(
            `[price-sync] Error fetching url_products for store ${storeId}:`,
            urlProductsError
          );
          storeFatalError = true;
          totalErrors++;
          // Mark as failed and continue
          try {
            await supabase.rpc("mark_competitor_sync_result", {
              p_store_id: storeId,
              p_status: "failed",
              p_updated_count: storeUpdatedCount,
            });
          } catch (rpcError) {
            console.error(`[price-sync] Error calling mark_competitor_sync_result:`, rpcError);
          }
          continue;
        }

        // Scrape and update competitor_url_products
        if (urlProducts && urlProducts.length > 0) {
          console.log(
            `[price-sync] Found ${urlProducts.length} competitor_url_products for store ${storeId}`
          );

          for (const urlProduct of urlProducts) {
            if (!urlProduct.competitor_url) continue;

            try {
              const scraped = await scrapePriceFromUrl(urlProduct.competitor_url);

              if (scraped.price !== null) {
                // Check if price changed or last_checked_at was null
                const priceChanged = urlProduct.last_price !== scraped.price;
                const wasNeverChecked = urlProduct.last_checked_at === null;

                const { error: updateError } = await supabase
                  .from("competitor_url_products")
                  .update({
                    last_price: scraped.price,
                    last_checked_at: syncTime,
                  })
                  .eq("id", urlProduct.id);

                if (updateError) {
                  console.error(
                    `[price-sync] Error updating url_product ${urlProduct.id}:`,
                    updateError
                  );
                } else {
                  totalProcessed++;
                  // Increment updatedCount if price changed or was never checked
                  if (priceChanged || wasNeverChecked) {
                    storeUpdatedCount++;
                  }
                }
              } else {
                // Still update last_checked_at even if price is null
                const wasNeverChecked = urlProduct.last_checked_at === null;
                await supabase
                  .from("competitor_url_products")
                  .update({
                    last_checked_at: syncTime,
                  })
                  .eq("id", urlProduct.id);
                // Increment if was never checked (even if price is null, we checked it)
                if (wasNeverChecked) {
                  storeUpdatedCount++;
                }
              }
            } catch (error) {
              console.error(
                `[price-sync] Error scraping ${urlProduct.competitor_url}:`,
                error
              );
              // Continue with next URL (non-fatal)
            }
          }
        }

        // 3. After successful processing, call RPCs
        try {
          // Call mark_store_sync_run(store_id, sync_time)
          const { error: markError } = await supabase.rpc("mark_store_sync_run", {
            p_store_id: storeId,
            p_sync_time: syncTime,
          });

          if (markError) {
            console.error(
              `[price-sync] Error calling mark_store_sync_run for store ${storeId}:`,
              markError
            );
          }

          // Call touch_store_sync_settings(store_id)
          const { error: touchError } = await supabase.rpc(
            "touch_store_sync_settings",
            {
              p_store_id: storeId,
            }
          );

          if (touchError) {
            console.error(
              `[price-sync] Error calling touch_store_sync_settings for store ${storeId}:`,
              touchError
            );
          }

          // Call mark_competitor_sync_result(store_id, status, updated_count)
          const { error: syncResultError } = await supabase.rpc(
            "mark_competitor_sync_result",
            {
              p_store_id: storeId,
              p_status: "success",
              p_updated_count: storeUpdatedCount,
            }
          );

          if (syncResultError) {
            console.error(
              `[price-sync] Error calling mark_competitor_sync_result for store ${storeId}:`,
              syncResultError
            );
          } else {
            console.log(
              `[price-sync] Marked sync result for store ${storeId}: success, ${storeUpdatedCount} updated`
            );
          }
        } catch (error) {
          console.error(
            `[price-sync] Error calling RPCs for store ${storeId}:`,
            error
          );
          // Mark as failed if RPC calls fail
          try {
            await supabase.rpc("mark_competitor_sync_result", {
              p_store_id: storeId,
              p_status: "failed",
              p_updated_count: storeUpdatedCount,
            });
          } catch (rpcError) {
            console.error(`[price-sync] Error calling mark_competitor_sync_result:`, rpcError);
          }
        }
      } catch (error) {
        console.error(`[price-sync] Error processing store ${storeId}:`, error);
        storeFatalError = true;
        totalErrors++;
        // Mark as failed
        try {
          await supabase.rpc("mark_competitor_sync_result", {
            p_store_id: storeId,
            p_status: "failed",
            p_updated_count: storeUpdatedCount,
          });
        } catch (rpcError) {
          console.error(`[price-sync] Error calling mark_competitor_sync_result:`, rpcError);
        }
        // Continue with next store
      }
    }

    console.log(
      `[price-sync] Completed. Processed: ${totalProcessed}, Errors: ${totalErrors}`
    );

    return new Response(
      JSON.stringify({
        message: "Price sync completed",
        storesProcessed: dueStores.length,
        pricesUpdated: totalProcessed,
        errors: totalErrors,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[price-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

