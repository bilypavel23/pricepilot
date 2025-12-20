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

  // 2) Check if there are any competitors for this store (store competitors OR URL competitors)
  const { count: competitorsCount } = await supabase
    .from("competitors")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  const { count: urlCompetitorsCount } = await supabase
    .from("competitor_url_products")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  // If no competitors at all (neither store nor URL), return 0
  if ((!competitorsCount || competitorsCount === 0) && (!urlCompetitorsCount || urlCompetitorsCount === 0)) {
    return 0;
  }

  // 3) Load competitor_product_matches for these products (ONLY confirmed matches) - store competitors
  const { data: matches } = await supabase
    .from("competitor_product_matches")
    .select("product_id, competitor_product_id")
    .in("product_id", productIds);

  // 4) Load URL competitors from competitor_url_products
  const { data: urlCompetitors } = await supabase
    .from("competitor_url_products")
    .select("product_id, last_price")
    .in("product_id", productIds)
    .eq("store_id", storeId);

  // 5) Build a map of product_id -> competitor prices (store + URL combined)
  const productCompetitorPrices = new Map<string, number[]>();

  // Add store competitor prices
  if (matches && matches.length > 0) {
    const competitorProductIds = matches.map((m) => m.competitor_product_id).filter(Boolean);

    if (competitorProductIds.length > 0) {
      // Load competitor_products prices
      const { data: competitorProducts } = await supabase
        .from("competitor_products")
        .select("id, price")
        .in("id", competitorProductIds);

      if (competitorProducts && competitorProducts.length > 0) {
        for (const match of matches) {
          const cp = competitorProducts.find((cp) => cp.id === match.competitor_product_id);
          if (cp && cp.price != null) {
            const prices = productCompetitorPrices.get(match.product_id) || [];
            prices.push(Number(cp.price));
            productCompetitorPrices.set(match.product_id, prices);
          }
        }
      }
    }
  }

  // Add URL competitor prices
  if (urlCompetitors && urlCompetitors.length > 0) {
    for (const uc of urlCompetitors) {
      if (uc.last_price != null && uc.last_price > 0) {
        const productId = uc.product_id as string;
        const prices = productCompetitorPrices.get(productId) || [];
        prices.push(Number(uc.last_price));
        productCompetitorPrices.set(productId, prices);
      }
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





