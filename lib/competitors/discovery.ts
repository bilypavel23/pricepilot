/**
 * Competitor Store Discovery - Scrapes competitor stores and saves products
 * Server-only module
 * 
 * CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
 * - All persistent logic must rely on: competitor_match_candidates and competitor_product_matches
 * - Never read from competitor_store_products for persistent data
 */

import * as cheerio from "cheerio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDiscoveryQuota } from "@/lib/discovery-quota";
import { scrapeCompetitorProducts } from "@/lib/competitors/scrape";

export interface RunDiscoveryParams {
  storeId: string;
  competitorId: string;
  competitorUrl: string;
  plan?: string | null;
}

/**
 * Extract domain from URL (removes www. prefix)
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Scrape product listing page URLs from competitor store
 * Supports:
 * - webscraper.io/test-sites/e-commerce/allinone
 * - books.toscrape.com
 */
export async function scrapeStoreProductUrls(baseUrl: string): Promise<string[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.warn("[discovery] Missing SCRAPINGBEE_API_KEY");
    return [];
  }

  const urls: string[] = [];
  const MAX_PAGES = 20;
  const MAX_PRODUCTS = 300;

  // Build pagination URLs
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (urls.length >= MAX_PRODUCTS) break;

    const pageUrl = page === 1 
      ? baseUrl 
      : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}page=${page}`;

    try {
      const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${encodeURIComponent(
        apiKey
      )}&url=${encodeURIComponent(pageUrl)}&render_js=false`;

      console.log("[discovery] ScrapingBee fetch:", { pageUrl, page });

      const res = await fetch(scrapingBeeUrl);
      if (!res.ok) {
        console.error("[discovery] ScrapingBee status", res.status, pageUrl);
        if (res.status === 429 || res.status === 402) {
          break; // Out of credits
        }
        continue;
      }

      const html = await res.text();
      const pageUrls = parseProductUrls(html, baseUrl);

      if (pageUrls.length === 0) {
        break; // No more products
      }

      urls.push(...pageUrls);
      
      if (pageUrls.length < 3) {
        break; // Last page
      }
    } catch (error) {
      console.error("[discovery] ScrapingBee error:", error, pageUrl);
      continue;
    }
  }

  // Deduplicate and limit
  const unique = Array.from(new Set(urls));
  return unique.slice(0, MAX_PRODUCTS);
}

/**
 * Parse product URLs from HTML listing page
 */
function parseProductUrls(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  // webscraper.io/test-sites/e-commerce/allinone
  if (baseUrl.includes("webscraper.io")) {
    $("a.title").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absolute = absoluteUrl(baseUrl, href);
        if (absolute) urls.push(absolute);
      }
    });
  }
  // books.toscrape.com
  else if (baseUrl.includes("books.toscrape.com")) {
    $("article.product_pod h3 a").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absolute = absoluteUrl(baseUrl, href);
        if (absolute && absolute.includes("/catalogue/") && absolute.endsWith("index.html")) {
          urls.push(absolute);
        }
      }
    });
  }
  // Generic fallback
  else {
    $("a[href*='/product'], a[href*='/products'], a[href*='/p/']").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absolute = absoluteUrl(baseUrl, href);
        if (absolute) urls.push(absolute);
      }
    });
  }

  return urls;
}

/**
 * Scrape product details from product page
 */
export async function scrapeProductDetails(productUrl: string): Promise<{
  title: string;
  price: number | null;
  currency: string;
}> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    return { title: "", price: null, currency: "USD" };
  }

  try {
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${encodeURIComponent(
      apiKey
    )}&url=${encodeURIComponent(productUrl)}&render_js=false`;

    const res = await fetch(scrapingBeeUrl);
    if (!res.ok) {
      console.error("[discovery] ScrapingBee product page status", res.status, productUrl);
      return { title: "", price: null, currency: "USD" };
    }

    const html = await res.text();
    return parseProductDetails(html, productUrl);
  } catch (error) {
    console.error("[discovery] ScrapingBee product page error:", error, productUrl);
    return { title: "", price: null, currency: "USD" };
  }
}

/**
 * Parse product details from HTML
 */
function parseProductDetails(html: string, productUrl: string): {
  title: string;
  price: number | null;
  currency: string;
} {
  const $ = cheerio.load(html);
  let title = "";
  let price: number | null = null;
  let currency = "USD";

  // webscraper.io/test-sites/e-commerce/allinone
  if (productUrl.includes("webscraper.io")) {
    title = $(".caption h4 a").first().text().trim() || 
            $("h4 a.title").first().text().trim() ||
            $("h4.title").first().text().trim() ||
            "";
    
    const priceText = $(".caption h4.price").first().text().trim() ||
                      $(".price").first().text().trim() ||
                      "";
    const parsed = parsePrice(priceText);
    price = parsed.price;
    currency = parsed.currency;
  }
  // books.toscrape.com
  else if (productUrl.includes("books.toscrape.com")) {
    title = $("div.product_main h1").first().text().trim() || "";
    const priceText = $("p.price_color").first().text().trim() || "";
    const parsed = parsePrice(priceText);
    price = parsed.price;
    currency = parsed.currency;
  }
  // Generic fallback
  else {
    title = $("h1").first().text().trim() || "";
    const priceText = $(".price, [data-price], .product-price").first().text().trim() || "";
    const parsed = parsePrice(priceText);
    price = parsed.price;
    currency = parsed.currency;
  }

  return { title, price, currency };
}

/**
 * Parse price string to number and detect currency
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
 * Convert relative URL to absolute
 */
function absoluteUrl(base: string, href: string): string {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }
    const baseUrl = new URL(base);
    return new URL(href, `${baseUrl.protocol}//${baseUrl.host}`).toString();
  } catch {
    return href;
  }
}

/**
 * Main discovery function
 */
export async function runCompetitorDiscovery({
  storeId,
  competitorId,
  competitorUrl,
  plan,
}: RunDiscoveryParams): Promise<{ success: boolean; productsScraped: number; error?: string }> {
  console.log("[discovery] START", { competitorId, storeId, competitorUrl });

  try {
    // 1. Update competitor: set domain, set status="processing", set updated_at
    const domain = extractDomain(competitorUrl);
    await supabaseAdmin
      .from("competitors")
      .update({
        domain: domain || null,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", competitorId);

    // 2. Load quota
    const quota = await getDiscoveryQuota(storeId, plan);
    if (!quota) {
      const error = "Failed to get discovery quota";
      console.error("[discovery] quota error:", error);
      return { success: false, productsScraped: 0, error };
    }

    // 3. Check remaining quota
    const remaining = quota.limit_amount - quota.used;
    if (remaining <= 0) {
      const error = "Discovery quota exhausted";
      console.error("[discovery] quota exhausted:", { remaining, limit: quota.limit_amount });
      return { success: false, productsScraped: 0, error };
    }

    // 4. Scrape products (general listing crawler / Shopify)
    const scraped = await scrapeCompetitorProducts(competitorUrl);

    if (scraped.length === 0) {
      const error = "No products found";
      console.error("[discovery] no products:", { competitorUrl });
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "failed",
          last_sync_at: now,
          updated_at: now,
        })
        .eq("id", competitorId);
      return { success: false, productsScraped: 0, error };
    }

    // 5. Limit to remaining quota
    const itemsToUpsert = scraped.slice(0, remaining);
    console.log("[discovery] scraping products", { total: itemsToUpsert.length, remaining });

    // 6. Upsert to competitor_store_products
    const now = new Date().toISOString();
    let successCount = 0;

    for (const item of itemsToUpsert) {
      if (!item?.name || !item?.url) continue;

      // Guard: Validate that name doesn't look like a price
      const pricePattern = /^\s*\$?\s*\d+(\.\d+)?\s*$/;
      let competitorName = item.name.trim();
      
      if (pricePattern.test(competitorName)) {
        // Name looks like a price - skip this product
        console.warn("[discovery] Name looks like price, skipping", { url: item.url, name: competitorName, price: item.price });
        continue;
      }

      // Ensure price is numeric
      let numericPrice: number | null = null;
      if (item.price != null) {
        if (typeof item.price === 'number') {
          numericPrice = item.price > 0 ? item.price : null;
        } else if (typeof item.price === 'string') {
          const priceStr = String(item.price);
          const cleaned = priceStr.replace(/[$£€,\s]/g, '').trim();
          const parsed = parseFloat(cleaned);
          numericPrice = !isNaN(parsed) && parsed > 0 ? parsed : null;
        }
      }

      // Log parsed values before insert
      console.log("[discovery] Upserting product", {
        url: item.url,
        name: competitorName,
        price: numericPrice,
        currency: item.currency || "USD",
      });

      const { error: upsertError } = await supabaseAdmin
        .from("competitor_store_products")
        .upsert(
          {
            store_id: storeId,
            competitor_id: competitorId,
            competitor_url: item.url,
            competitor_name: competitorName,
            last_price: numericPrice,
            currency: item.currency || "USD",
            last_checked_at: now,
          },
          { onConflict: "competitor_id,competitor_url" }
        );

      if (upsertError) {
        console.error("[discovery] upsert error:", upsertError, item.url);
        continue;
      }

      successCount++;
    }

    if (successCount === 0) {
      const error = "No products successfully scraped";
      console.error("[discovery] no products scraped");
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "failed",
          last_sync_at: now,
          updated_at: now,
        })
        .eq("id", competitorId);
      return { success: false, productsScraped: 0, error };
    }

    // 7. Increment quota
    await supabaseAdmin
      .from("competitor_discovery_quota")
      .update({
        used_products: quota.used + successCount,
      })
      .eq("store_id", storeId)
      .eq("period_start", quota.period_start);

    // 8. DEBUG - Check count of competitor_store_products BEFORE build call
    // This helps diagnose if deletion is happening prematurely or RLS is blocking
    const { count: stagingCount, error: countError } = await supabaseAdmin
      .from("competitor_store_products")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("competitor_id", competitorId);
    
    console.log(`[discovery] DEBUG: competitor_store_products count BEFORE build: ${stagingCount || 0} (error: ${countError ? JSON.stringify(countError) : 'none'})`);
    
    if (stagingCount === 0) {
      console.error(`[discovery] ERROR: competitor_store_products is EMPTY before build call! store_id=${storeId}, competitor_id=${competitorId}`);
      console.error(`[discovery] This indicates either: 1) premature deletion, 2) RLS blocking, or 3) insert failed silently`);
    }

    // 9. Call RPC build_match_candidates_for_competitor_store
    // This RPC:
    // - Deletes old candidates for (store_id, competitor_id)
    // - Computes similarity between scraped products and store products using pg_trgm
    // - Inserts matched items directly into competitor_match_candidates (top-1 per competitor product)
    // - Returns inserted count
    // - Does NOT persist unmatched competitor products
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "build_match_candidates_for_competitor_store",
      {
        p_store_id: storeId,
        p_competitor_id: competitorId,
      }
    );

    if (rpcError) {
      console.error("[discovery] RPC error:", rpcError);
      // Continue anyway
    } else {
      // Log the returned count from RPC
      const insertedCount = typeof rpcResult === 'number' ? rpcResult : rpcResult?.inserted_count || rpcResult?.count || 0;
      console.log(`[discovery] build_match_candidates_for_competitor_store returned count: ${insertedCount}`);
      
      if (insertedCount === 0) {
        console.warn(`[discovery] No candidates were inserted for store_id=${storeId}, competitor_id=${competitorId}. Check competitor_store_products.`);
      }
      
      // NOTE: Deletion of competitor_store_products is DISABLED for now.
      // The get_competitor_products_for_store_matches RPC will handle fallback build automatically.
      // 10. Deletion removed - competitor_store_products is kept for fallback builds
      // const { error: deleteError } = await supabaseAdmin
      //   .from("competitor_store_products")
      //   .delete()
      //   .eq("store_id", storeId)
      //   .eq("competitor_id", competitorId);
    }

    // 10. Update competitor status="active" and last_sync_at
    await supabaseAdmin
      .from("competitors")
      .update({
        status: "active",
        last_sync_at: now,
        updated_at: now,
      })
      .eq("id", competitorId);

    console.log("[discovery] COMPLETE", {
      competitorId,
      storeId,
      productsScraped: successCount,
    });

    return { success: true, productsScraped: successCount };
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    console.error("[discovery] ERROR:", {
      competitorId,
      storeId,
      error: errorMessage,
      stack: error.stack,
    });

    // Update competitor status to "failed" on error
    await supabaseAdmin
      .from("competitors")
      .update({
        status: "failed",
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", competitorId);

    return { success: false, productsScraped: 0, error: errorMessage };
  }
}

