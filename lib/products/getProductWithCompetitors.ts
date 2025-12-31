import { createClient } from "@/lib/supabase/server";
import { getCompetitorsForProduct } from "@/lib/competitors/getCompetitorsForProduct";

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
    matchId: string; // For compatibility, can be competitor_id or url product id
    competitorId: string | null; // null for URL competitors
    competitorName: string;
    competitorUrl: string | null;
    competitorProductId: string | null; // null for URL competitors
    competitorProductName: string | null;
    competitorProductUrl: string | null;
    competitorPrice: number | null; // Use last_price from DB
    lastSyncAt: string | null;
    source: "Store" | "URL";
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

  // 2) Load competitors using the same data source and mapping as Recommendations
  const { competitors: allCompetitors, storeCompetitors, urlCompetitors } = await getCompetitorsForProduct(
    supabase,
    storeId,
    productId
  );

  // Map to ProductWithCompetitors format
  const competitorList: ProductWithCompetitors["competitors"] = allCompetitors.map((comp) => ({
    matchId: comp.matchId,
    competitorId: comp.competitorId,
    competitorName: comp.competitorName,
    competitorUrl: comp.competitorUrl,
    competitorProductId: comp.competitorProductId,
    competitorProductName: comp.competitorName, // Use competitorName for product name
    competitorProductUrl: comp.competitorUrl, // Use competitorUrl for product URL
    competitorPrice: comp.competitorPrice,
    lastSyncAt: comp.lastChecked,
    source: comp.source,
  }));

  // Calculate competitor average from prices
  const prices = allCompetitors
    .map((c) => c.competitorPrice)
    .filter((p): p is number => p != null && p > 0);
  const competitorAvg = prices.length > 0
    ? prices.reduce((sum, v) => sum + v, 0) / prices.length
    : 0;

  console.log(`[getProductWithCompetitors] Competitors loaded: ${allCompetitors.length} total`, {
    storeCompetitors: storeCompetitors.length,
    urlCompetitors: urlCompetitors.length,
  });

  return {
    product,
    competitors: competitorList,
    competitorAvg,
  };
}




