import { createClient } from "@/lib/supabase/server";

/**
 * Calculate the number of products that have recommendations waiting.
 * 
 * A product has a recommendation waiting if:
 * - It has at least 1 competitor (from competitor_url_products or competitor_product_matches)
 * - It has competitor prices (competitor_avg > 0)
 * - The competitor average differs from the product's current price
 * 
 * Uses the same data sources as getRecommendationsForStore:
 * - competitor_url_products (URL competitors)
 * - competitor_product_matches (Store competitors)
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

  const productIds = products.map((p) => p.id).filter(Boolean);

  if (productIds.length === 0) {
    return 0;
  }

  // 2) Load competitors from competitor_url_products and competitor_product_matches
  // Same approach as getRecommendationsForStore
  const productCompetitorPrices = new Map<string, number[]>();

  try {
    // Query competitor_product_matches
    const { data: matches, error: matchesError } = await supabase
      .from("competitor_product_matches")
      .select("product_id, last_price")
      .eq("store_id", storeId)
      .in("product_id", productIds);

    if (matchesError) {
      console.error("[reco-count] Error querying competitor_product_matches:", matchesError);
    } else {
      const matchesRows = matches ?? [];
      for (const row of matchesRows) {
        const productId = String(row.product_id);
        const price = row.last_price != null ? Number(row.last_price) : null;
        
        if (productId && price != null && price > 0) {
          const prices = productCompetitorPrices.get(productId) || [];
          prices.push(price);
          productCompetitorPrices.set(productId, prices);
        }
      }
    }

    // Query competitor_url_products
    const { data: urlRows, error: urlRowsError } = await supabase
      .from("competitor_url_products")
      .select("product_id, last_price")
      .eq("store_id", storeId)
      .in("product_id", productIds);

    if (urlRowsError) {
      console.error("[reco-count] Error querying competitor_url_products:", urlRowsError);
    } else {
      const urlCompetitorRows = urlRows ?? [];
      for (const row of urlCompetitorRows) {
        const productId = String(row.product_id);
        const price = row.last_price != null ? Number(row.last_price) : null;
        
        if (productId && price != null && price > 0) {
          const prices = productCompetitorPrices.get(productId) || [];
          prices.push(price);
          productCompetitorPrices.set(productId, prices);
        }
      }
    }
  } catch (err) {
    console.error("getRecommendationsWaitingCount: exception loading competitors", err);
    // Continue execution even if query fails
  }

  // If no competitors found at all, return 0
  if (productCompetitorPrices.size === 0) {
    return 0;
  }

  // 3) Count products where competitor_avg differs from my price
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





