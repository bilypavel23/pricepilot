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

  // 2) Load competitors ONLY from v_product_competitor_links view
  // Group by product_id - each product shows its matched competitors
  // NOTE: URL competitors have competitor_id = null, Store competitors have competitor_id set
  // DO NOT query competitors table - all data comes from v_product_competitor_links
  let competitorsByProduct = new Map<string, any[]>();

  if (productIds.length > 0) {
    try {
      // Query v_product_competitor_links view for all products at once
      // This view contains both Store competitors (competitor_id set) and URL competitors (competitor_id null)
      // NOTE: competitor_id can be null for URL competitors - this is expected and correct
      // DO NOT read from competitor_url_products or any other table - ONLY v_product_competitor_links
      const { data: linksData, error: linksError } = await supabase
        .from("v_product_competitor_links")
        .select("product_id, competitor_id, competitor_name, competitor_url, competitor_price, last_price, currency, source")
        .eq("store_id", storeId)
        .in("product_id", productIds)
        .order("competitor_price", { ascending: true, nullsFirst: false }); // Order by competitor_price asc nulls last

      // Debug logs
      console.log("[reco] Querying v_product_competitor_links for storeId:", storeId, "productIds:", productIds.length);
      console.log("[reco] v_product_competitor_links rows", linksData?.length, linksData?.[0]);
      if (linksError) {
        console.error("[reco] ERROR querying v_product_competitor_links:", JSON.stringify(linksError, null, 2));
      }

      if (linksError) {
        console.error("getRecommendationsForStore: v_product_competitor_links error", JSON.stringify(linksError, null, 2));
      } else {
        const rows = linksData ?? [];
        console.log("[reco] Loaded", rows.length, "competitor links from v_product_competitor_links");
        
        // Group by product_id
        // A competitor EXISTS if competitor_name IS NOT NULL AND competitor_url IS NOT NULL
        rows.forEach((row: any) => {
          const pid = row.product_id as string;
          if (!pid) return;
          
          // Filter: only include competitors that have both name and url
          if (!row.competitor_name || !row.competitor_url) {
            console.log("[reco] Skipping competitor row - missing name or url:", { 
              product_id: pid, 
              has_name: !!row.competitor_name, 
              has_url: !!row.competitor_url 
            });
            return;
          }
          
          if (!competitorsByProduct.has(pid)) {
            competitorsByProduct.set(pid, []);
          }
          
          competitorsByProduct.get(pid)!.push({
            product_id: pid,
            competitor_id: row.competitor_id || null, // null for URL competitors - this is expected and correct
            competitor_name: row.competitor_name,
            competitor_url: row.competitor_url,
            competitor_price: row.competitor_price, // Legacy field, can be null
            last_price: row.last_price, // Primary price field from v_product_competitor_links
            currency: row.currency || "USD",
            source: row.source || (row.competitor_id ? "Store" : "URL"), // Use source from view if available
          });
        });
        
        // Competitors are already sorted by competitor_price asc nulls last from SQL query
        // No need to sort again in JavaScript
        
        console.log("[reco] Grouped competitors by product:", Array.from(competitorsByProduct.entries()).map(([pid, comps]) => ({ productId: pid, count: comps.length })));
      }
    } catch (err) {
      console.error("getRecommendationsForStore: exception loading competitors", err);
      // Continue execution even if query fails - we'll just have no competitors
    }
  }

  // 3) Recommendations uses ONLY v_product_competitor_links
  // DO NOT query competitor_product_matches, product_competitor_matches, or competitors table

  const recommendations: ProductRecommendation[] = [];

  for (const p of products) {
    const productId = p.id as string;
    const productName = (p.name as string) ?? "Product name";
    const productSku = (p.sku ?? null) as string | null;
    const productPrice = (p.price ?? null) as number | null;

    // Get competitors from v_product_competitor_links (grouped by product_id)
    // Already sorted by competitor_price asc nulls last from SQL query
    // NOTE: competitor_id can be NULL for source='URL' (don't filter it out)
    // Product has competitors if: EXISTS (select 1 from v_product_competitor_links where product_id = p.id and store_id = p.store_id)
    const trackedCompetitors = competitorsByProduct.get(productId) ?? [];

    // Debug log
    console.log("[reco] for product", productId, productName, "has", trackedCompetitors.length, "competitors");
    if (trackedCompetitors.length > 0) {
      console.log("[reco] First competitor:", trackedCompetitors[0]);
    }

    // Competitor exists if competitor_name IS NOT NULL AND competitor_url IS NOT NULL
    // DO NOT require competitor_price to be non-null
    // Filter out competitors that don't have name or url
    const validCompetitors = trackedCompetitors.filter(
      (tc) => tc.competitor_name != null && tc.competitor_url != null
    );

    // competitorCount = total number of valid competitors (regardless of price)
    const competitorCount = validCompetitors.length;

    // Calculate average price only from competitors that have price
    // Use last_price ?? competitor_price for calculations
    const prices: number[] = [];
    for (const tc of validCompetitors) {
      const price = tc.last_price ?? tc.competitor_price;
      const competitorPrice = price != null ? Number(price) : null;
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
    // Use last_price ?? competitor_price for calculations
    // DO NOT create placeholder slots - render only actual competitors
    validCompetitors.forEach((tc) => {
      // Use last_price ?? competitor_price (as specified)
      const price = tc.last_price ?? tc.competitor_price;
      const competitorPrice = price != null ? Number(price) : null;
      const oldPrice = null; // not tracked for now
      
      // Calculate percent change using the same formula as left summary
      // Formula: delta = competitorPrice - yourPrice, pct = (delta / yourPrice) * 100
      // If pct > 0: competitor is higher than you (+X%)
      // If pct < 0: competitor is lower than you (-X%)
      const changePercent = productPrice != null && productPrice > 0 && competitorPrice != null
        ? pctVsYourPrice(productPrice, competitorPrice)
        : null;

      // Use competitor_name for display (from v_product_competitor_links)
      // source is already set from the view (Store or URL)
      // competitor_id can be null for URL competitors - this is expected
      
      const slot: CompetitorSlot = {
        label: "", // Will be set after sorting
        name: tc.competitor_name || null,
        url: tc.competitor_url ?? null,
        oldPrice,
        newPrice: competitorPrice, // null if price not available
        changePercent, // null if price not available - shows how much my price is higher/lower
        source: tc.source || (tc.competitor_id ? "Store" : "URL"),
        isUrlCompetitor: !tc.competitor_id, // deprecated, but keep for backward compatibility
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

