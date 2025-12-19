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

  // 2) Check if there are any competitors for this store
  const { count: competitorsCount } = await supabase
    .from("competitors")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  if (!competitorsCount || competitorsCount === 0) {
    return 0;
  }

  // 3) Load product_matches for these products (only confirmed/auto_confirmed)
  const { data: matches } = await supabase
    .from("product_matches")
    .select("product_id, competitor_product_id")
    .eq("store_id", storeId)
    .in("product_id", productIds)
    .in("status", ["confirmed", "auto_confirmed"]);

  if (!matches || matches.length === 0) {
    return 0;
  }

  const competitorProductIds = matches.map((m) => m.competitor_product_id);

  // 4) Load competitor_products prices
  const { data: competitorProducts } = await supabase
    .from("competitor_products")
    .select("id, price")
    .in("id", competitorProductIds);

  if (!competitorProducts || competitorProducts.length === 0) {
    return 0;
  }

  // 5) Build a map of product_id -> competitor prices
  const productCompetitorPrices = new Map<string, number[]>();

  for (const match of matches) {
    const cp = competitorProducts.find((cp) => cp.id === match.competitor_product_id);
    if (cp && cp.price != null) {
      const prices = productCompetitorPrices.get(match.product_id) || [];
      prices.push(Number(cp.price));
      productCompetitorPrices.set(match.product_id, prices);
    }
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




