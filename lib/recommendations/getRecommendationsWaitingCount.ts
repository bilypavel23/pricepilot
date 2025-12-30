import { createClient } from "@/lib/supabase/server";

/**
 * Calculate the number of products that have recommendations waiting.
 * A product has a recommendation waiting if:
 * - It has at least 1 competitor price (competitor_avg > 0)
 * - The competitor average differs from the product's current price by at least 0.01 (or 0.1%)
 */
export async function getRecommendationsWaitingCount(storeId: string): Promise<number> {
  const supabase = await createClient();

  // 1) Load active products for this store
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, price")
    .eq("store_id", storeId)
    .eq("status", "active");

  if (productsError || !products || products.length === 0) {
    return 0;
  }

  const productIds = products.map((p) => p.id);

  // 2) Load competitors ONLY from v_product_competitor_links view
  // DO NOT query competitors table - check competitors via v_product_competitor_links
  // NOTE: URL competitors have competitor_id = null, Store competitors have competitor_id set
  // Product has competitors if EXISTS (select 1 from v_product_competitor_links where product_id = p.id and store_id = p.store_id)
  const productCompetitorPrices = new Map<string, number[]>();

  if (productIds.length > 0) {
    try {
      // Query v_product_competitor_links view
      // NOTE: competitor_id can be null for URL competitors - this is expected and correct
      const { data: linksData, error: linksError } = await supabase
        .from("v_product_competitor_links")
        .select("product_id, competitor_price")
        .eq("store_id", storeId)
        .in("product_id", productIds);

      if (linksError) {
        console.error("getRecommendationsWaitingCount: v_product_competitor_links error", JSON.stringify(linksError, null, 2));
      } else {
        const rows = linksData ?? [];
        
        // Add tracked competitor prices from v_product_competitor_links
        // Only add prices (not count competitors) - competitors are counted separately
        for (const row of rows) {
          const productId = row.product_id as string;
          const competitorPrice = row.competitor_price != null ? Number(row.competitor_price) : null;
          
          // Only add to prices array if price is available and > 0
          // But DO NOT filter out competitors - they are counted separately
          if (productId && competitorPrice != null && competitorPrice > 0) {
            const prices = productCompetitorPrices.get(productId) || [];
            prices.push(competitorPrice);
            productCompetitorPrices.set(productId, prices);
          }
        }
      }
    } catch (err) {
      console.error("getRecommendationsWaitingCount: exception loading competitors", err);
      // Continue execution even if query fails
    }
  }

  // If no competitors found at all, return 0
  if (productCompetitorPrices.size === 0) {
    return 0;
  }

  // 6) Count products where competitor_avg differs from my price
  let recommendationsWaiting = 0;
  const TOLERANCE = 0.01; // Minimum difference to count as a recommendation

  for (const product of products) {
    const productId = product.id as string;
    const myPrice = product.price ?? null;

    if (myPrice == null || myPrice <= 0) {
      continue;
    }

    const competitorPrices = productCompetitorPrices.get(productId);
    if (!competitorPrices || competitorPrices.length === 0) {
      continue;
    }

    // Calculate competitor average
    const competitorAvg =
      competitorPrices.reduce((sum, v) => sum + v, 0) / competitorPrices.length;

    if (competitorAvg <= 0) {
      continue;
    }

    // Check if there's a meaningful difference
    const diff = Math.abs(competitorAvg - myPrice);
    if (diff >= TOLERANCE) {
      recommendationsWaiting++;
    }
  }

  return recommendationsWaiting;
}





