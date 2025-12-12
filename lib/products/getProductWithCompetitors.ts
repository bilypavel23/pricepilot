import { createClient } from "@/lib/supabase/server";

export interface ProductWithCompetitors {
  product: {
    id: string;
    name: string;
    sku: string | null;
    price: number | null;
    cost: number | null;
    inventory: number | null;
    status: string;
  };
  competitors: Array<{
    competitorId: string;
    competitorName: string;
    competitorUrl: string | null;
    competitorProductId: string;
    competitorProductName: string | null;
    competitorProductUrl: string | null;
    competitorPrice: number | null;
    lastSyncAt: string | null;
  }>;
  competitorAvg: number;
}

/**
 * Get a product with its matched competitors.
 */
export async function getProductWithCompetitors(
  productId: string,
  storeId: string
): Promise<ProductWithCompetitors | null> {
  const supabase = await createClient();

  // 1) Load product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, sku, price, cost, inventory, status")
    .eq("id", productId)
    .eq("store_id", storeId)
    .single();

  if (productError || !product) {
    return null;
  }

  // 2) Load product matches (confirmed/auto_confirmed)
  const { data: matches } = await supabase
    .from("product_matches")
    .select("competitor_product_id")
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .in("status", ["confirmed", "auto_confirmed"]);

  if (!matches || matches.length === 0) {
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  const competitorProductIds = matches.map((m) => m.competitor_product_id);

  // 3) Load competitor products with prices
  const { data: competitorProducts } = await supabase
    .from("competitor_products")
    .select("id, name, price, url, competitor_id")
    .in("id", competitorProductIds);

  if (!competitorProducts || competitorProducts.length === 0) {
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  // 4) Load competitors info
  const competitorIds = [...new Set(competitorProducts.map((cp) => cp.competitor_id))];
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, url, last_sync_at")
    .in("id", competitorIds);

  const competitorsMap = new Map(
    (competitors || []).map((c) => [c.id, c])
  );

  // 5) Build competitor list with prices
  const competitorList: ProductWithCompetitors["competitors"] = [];
  const prices: number[] = [];

  for (const cp of competitorProducts) {
    const competitor = competitorsMap.get(cp.competitor_id);
    if (!competitor) continue;

    if (cp.price != null && cp.price > 0) {
      prices.push(Number(cp.price));
    }

    competitorList.push({
      competitorId: competitor.id,
      competitorName: competitor.name,
      competitorUrl: competitor.url,
      competitorProductId: cp.id,
      competitorProductName: cp.name,
      competitorProductUrl: cp.url,
      competitorPrice: cp.price != null ? Number(cp.price) : null,
      lastSyncAt: competitor.last_sync_at,
    });
  }

  // 6) Calculate competitor average
  const competitorAvg = prices.length > 0
    ? prices.reduce((sum, v) => sum + v, 0) / prices.length
    : 0;

  return {
    product,
    competitors: competitorList,
    competitorAvg,
  };
}

