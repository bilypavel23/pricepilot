import { createClient } from "@/lib/supabase/server";
import type { ProductRecommendation, CompetitorSlot } from "./types";

/**
 * Calculate percentage difference between competitor price and your price.
 * Formula: delta = competitorPrice - yourPrice, pct = (delta / yourPrice) * 100
 * 
 * @param yourPrice - Your product price (base for calculation)
 * @param competitorPrice - Competitor product price
 * @returns Percentage difference, or null if calculation cannot be performed
 * 
 * Examples:
 * - yourPrice=1000, competitorPrice=372.70 => -62.73% (competitor is lower)
 * - yourPrice=500, competitorPrice=899.99 => +79.998% (competitor is higher)
 */
export function pctVsYourPrice(yourPrice: number, competitorPrice: number): number | null {
  if (yourPrice <= 0 || competitorPrice == null) {
    return null;
  }
  const delta = competitorPrice - yourPrice;
  const pct = (delta / yourPrice) * 100;
  return pct;
}

export async function getRecommendationsForStore(storeId: string): Promise<ProductRecommendation[]> {
  const supabase = await createClient();

  // 1) Load products for this store
  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, price")
    .eq("store_id", storeId)
    .eq("status", "active");

  if (productsError) {
    console.error("getRecommendationsForStore: products error", productsError);
    return [];
  }

  const products = productsData ?? [];

  if (products.length === 0) {
    // No products at all: return empty — the page will handle placeholder state.
    return [];
  }

  const productIds = products.map((p) => p.id).filter(Boolean);

  // 2) Load competitors from competitor_product_matches and competitor_url_products
  // Group by product_id - each product shows its matched competitors
  // DO NOT query v_product_competitor_links or competitor_store_products
  let competitorsByProduct = new Map<string, any[]>();

  if (productIds.length > 0) {
    try {
      // 1) Query competitor_product_matches
      // Select real columns that exist in the table
      const { data: matches, error: matchesError } = await supabase
        .from("competitor_product_matches")
        .select("product_id, competitor_id, competitor_product_id, competitor_name, competitor_url, last_price, currency, last_checked_at, created_at")
        .eq("store_id", storeId)
        .in("product_id", productIds);

      if (matchesError) {
        console.error("[reco] Error querying competitor_product_matches:", matchesError);
      }

      const matchesRows = matches ?? [];
      console.log("[reco] matches rows", matchesRows.length);
      console.log("[reco] First store_match row raw:", matchesRows?.[0]);

      // 2) Query competitor_url_products
      const { data: urlRows, error: urlRowsError } = await supabase
        .from("competitor_url_products")
        .select("product_id, competitor_url, competitor_name, last_price, currency, last_checked_at, created_at")
        .eq("store_id", storeId)
        .in("product_id", productIds);

      if (urlRowsError) {
        console.error("[reco] Error querying competitor_url_products:", urlRowsError);
      }

      const urlCompetitorRows = urlRows ?? [];
      console.log("[reco] url competitor rows", urlCompetitorRows.length);

      // 3) Build competitorsByProduct Map keyed by product_id
      
      // For each competitor_url_products row:
      urlCompetitorRows.forEach((row: any) => {
        const pid = String(row.product_id);
        if (!pid) return;

        if (!competitorsByProduct.has(pid)) {
          competitorsByProduct.set(pid, []);
        }

        competitorsByProduct.get(pid)!.push({
          product_id: pid,
          competitor_name: row.competitor_name ?? "Competitor URL", // name
          competitor_url: row.competitor_url, // url
          last_price: row.last_price != null ? Number(row.last_price) : null, // last_price: use last_price from competitor_url_products
          currency: row.currency || "USD", // currency
          last_checked_at: row.last_checked_at || null, // lastCheckedAt
          source: "url", // source
        });
      });

      // For each competitor_product_matches row:
      matchesRows.forEach((row: any) => {
        const pid = String(row.product_id);
        if (!pid) return;

        if (!competitorsByProduct.has(pid)) {
          competitorsByProduct.set(pid, []);
        }

        // Build competitor object using fields directly from competitor_product_matches
        // Do NOT set url/price/currency/lastCheckedAt to null - use row fields
        competitorsByProduct.get(pid)!.push({
          product_id: pid,
          competitor_name: row.competitor_name ?? "Competitor Store",
          competitor_url: row.competitor_url ?? null,
          last_price: row.last_price != null ? Number(row.last_price) : null, // Use last_price (not competitor_price or price)
          currency: row.currency ?? null,
          last_checked_at: row.last_checked_at ?? null,
          source: "store_match",
          competitor_id: row.competitor_id || null,
          competitor_product_id: row.competitor_product_id || null,
        });
      });

      console.log("[reco] competitorsByProduct size", competitorsByProduct.size);
      console.log("[reco] First competitor built:", matchesRows?.[0] ? competitorsByProduct.get(String(matchesRows[0].product_id))?.[0] : null);
      console.log("[reco] Grouped competitors by product:", Array.from(competitorsByProduct.entries()).map(([pid, comps]) => ({ productId: pid, count: comps.length })));
    } catch (err) {
      console.error("getRecommendationsForStore: exception loading competitors", err);
      // Continue execution even if query fails - we'll just have no competitors
    }
  }

  // 3) Recommendations uses competitor_product_matches and competitor_url_products
  // DO NOT query v_product_competitor_links or competitor_store_products

  const recommendations: ProductRecommendation[] = [];

  for (const p of products) {
    const productId = p.id as string;
    const productName = (p.name as string) ?? "Product name";
    const productSku = (p.sku ?? null) as string | null;
    const productPrice = (p.price ?? null) as number | null;

    // Get competitors from competitorsByProduct (grouped by product_id)
    // Built from competitor_product_matches and competitor_url_products
    const trackedCompetitors = competitorsByProduct.get(productId) ?? [];

    // Debug log
    console.log("[reco] for product", productId, productName, "has", trackedCompetitors.length, "competitors");
    if (trackedCompetitors.length > 0) {
      console.log("[reco] First competitor:", trackedCompetitors[0]);
    }

    // Competitor exists if it's in the map (regardless of price)
    // For store_match competitors, url may be null - still count them
    // For url competitors, both name and url should exist
    // Skip competitors with price === null in price-based computations, but still count them as linked competitors
    const validCompetitors = trackedCompetitors.filter(
      (tc) => {
        // URL competitors must have both name and url
        if (tc.source === "url") {
          return tc.competitor_name != null && tc.competitor_url != null;
        }
        // Store match competitors are valid even without url
        return tc.competitor_name != null;
      }
    );

    // competitorCount = total number of valid competitors (regardless of price)
    const competitorCount = validCompetitors.length;

    // Calculate average price only from competitors that have price
    // Skip competitors with price === null in price-based computations
    // Use last_price field (normalized to number | null)
    const prices: number[] = [];
    for (const tc of validCompetitors) {
      const competitorPrice = tc.last_price; // Use last_price field (from competitor_url_products.last_price)
      // Only include competitors with valid price (skip null prices)
      if (competitorPrice != null && competitorPrice > 0) {
        prices.push(competitorPrice);
      }
    }

    let competitorAvg = 0;
    if (prices.length > 0) {
      competitorAvg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
    }

    const competitorSlots: CompetitorSlot[] = [];

    // Build competitor slots from valid competitors only
    // Include ALL valid competitors (even if price is null)
    // Use last_price field (normalized to number | null)
    // DO NOT create placeholder slots - render only actual competitors
    validCompetitors.forEach((tc) => {
      // Use last_price field (from competitor_url_products.last_price for URL competitors, null for store_match)
      const competitorPrice = tc.last_price;
      const oldPrice = null; // not tracked for now
      
      // Calculate percent change using the same formula as left summary
      // Formula: delta = competitorPrice - yourPrice, pct = (delta / yourPrice) * 100
      // If pct > 0: competitor is higher than you (+X%)
      // If pct < 0: competitor is lower than you (-X%)
      const changePercent = productPrice != null && productPrice > 0 && competitorPrice != null
        ? pctVsYourPrice(productPrice, competitorPrice)
        : null;

      // Use competitor_name for display
      // source is "url" for competitor_url_products or "store_match" for competitor_product_matches
      
      // Map source: "url" -> "URL", "store_match" -> "Store"
      const sourceDisplay = tc.source === "url" ? "URL" : tc.source === "store_match" ? "Store" : (tc.competitor_id ? "Store" : "URL");
      
      const slot: CompetitorSlot = {
        label: "", // Will be set after sorting
        name: tc.competitor_name || null,
        url: tc.competitor_url ?? null,
        oldPrice,
        newPrice: competitorPrice, // null if price not available (uses last_price from DB)
        changePercent, // null if price not available - shows how much my price is higher/lower
        source: sourceDisplay,
        isUrlCompetitor: tc.source === "url", // deprecated, but keep for backward compatibility
        currency: tc.currency || null, // currency from DB
        lastCheckedAt: tc.last_checked_at || null, // ISO timestamp from DB
      };
      
      competitorSlots.push(slot);
    });

    // Sort competitors by percent change (ascending: cheapest competitor first, most expensive last)
    // Competitors with null price go to the end
    competitorSlots.sort((a, b) => {
      // nulls last
      if (a.changePercent == null && b.changePercent == null) return 0;
      if (a.changePercent == null) return 1;
      if (b.changePercent == null) return -1;
      // ascending order (lowest percent change first = cheapest competitor first)
      return (a.changePercent || 0) - (b.changePercent || 0);
    });

    // Set labels after sorting
    competitorSlots.forEach((slot, idx) => {
      slot.label = `Competitor ${idx + 1}`;
    });

    // Compute recommended price logic:
    // - CASE B (no competitors): recommendedPrice = productPrice, changePercent = 0
    // - CASE C (has competitors): recommendedPrice = competitorAvg (for now)
    let recommendedPrice: number | null = null;
    let changePercent = 0;
    let explanation = "";

    // Unlock recommendations if competitors.length > 0 (NOT based on price presence)
    if (competitorCount === 0) {
      // CASE B – no competitors
      recommendedPrice = productPrice;
      changePercent = 0;
      explanation = "Add at least 1 competitor to unlock recommendations.";
      competitorAvg = 0;
    } else if (competitorAvg === 0 || productPrice == null) {
      // CASE C – has competitors but no usable price data
      recommendedPrice = productPrice;
      changePercent = 0;
      explanation = "Waiting for competitor prices to be available.";
      competitorAvg = 0;
    } else {
      // CASE D – there are competitors with prices
      recommendedPrice = competitorAvg;
      changePercent = ((recommendedPrice - productPrice) / productPrice) * 100;

      if (changePercent > 0) {
        explanation = "Competitor prices are higher than yours.";
      } else if (changePercent < 0) {
        explanation = "Competitor prices are lower than yours.";
      } else {
        explanation = "Your price is aligned with competitors.";
      }
    }

    recommendations.push({
      productId,
      productName,
      productSku,
      productPrice,
      recommendedPrice,
      changePercent,
      competitorAvg,
      competitorCount,
      explanation,
      competitors: competitorSlots,
    });
  }

  return recommendations;
}

