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
    matchId: string; // product_matches.id
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

  // 2) Load product matches - query product_matches directly
  // Filter by product_id and store_id (we set both on insert)
  // Join competitor_products via competitor_product_id foreign key
  const { data: matches, error: matchesError } = await supabase
    .from("product_matches")
    .select("id, status, competitor_product_id")
    .eq("product_id", productId)
    .eq("store_id", storeId);

  if (matchesError) {
    console.error("[getProductWithCompetitors] Error loading matches:", matchesError);
    console.error("[getProductWithCompetitors] Error details:", {
      productId,
      storeId,
      error: matchesError
    });
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  if (!matches || matches.length === 0) {
    console.log("[getProductWithCompetitors] No matches found", { productId, storeId });
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  console.log("[getProductWithCompetitors] Found matches:", matches.length, { productId, storeId });

  // 3) Load competitor_products using the competitor_product_ids from matches
  const competitorProductIds = matches
    .map((m) => m.competitor_product_id)
    .filter(Boolean);
  
  if (competitorProductIds.length === 0) {
    console.warn("[getProductWithCompetitors] No competitor_product_ids found in matches");
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  const { data: competitorProducts, error: cpError } = await supabase
    .from("competitor_products")
    .select("id, name, url, price, competitor_id")
    .in("id", competitorProductIds);

  if (cpError) {
    console.error("[getProductWithCompetitors] Error loading competitor_products:", cpError);
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  if (!competitorProducts || competitorProducts.length === 0) {
    console.warn("[getProductWithCompetitors] No competitor_products found for ids:", competitorProductIds);
    return {
      product,
      competitors: [],
      competitorAvg: 0,
    };
  }

  // 4) Load competitor store info separately
  const competitorIds = [...new Set(competitorProducts.map((cp) => cp.competitor_id).filter(Boolean))];

  let competitorsMap = new Map();
  if (competitorIds.length > 0) {
    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name, url, last_sync_at")
      .in("id", competitorIds);
    
    if (competitors) {
      competitorsMap = new Map(competitors.map((c) => [c.id, c]));
    }
  }

  // 5) Build competitor list with prices
  const competitorList: ProductWithCompetitors["competitors"] = [];
  const prices: number[] = [];

  // Create a map of competitor_product_id -> competitor_product for quick lookup
  const cpMap = new Map(competitorProducts.map((cp) => [cp.id, cp]));

  for (const match of matches) {
    const cp = cpMap.get(match.competitor_product_id);
    if (!cp) {
      console.warn("[getProductWithCompetitors] Competitor product not found for id:", match.competitor_product_id);
      continue;
    }

    const competitor = competitorsMap.get(cp.competitor_id);
    if (!competitor) {
      console.warn("[getProductWithCompetitors] Competitor not found for id:", cp.competitor_id);
      continue;
    }

    if (cp.price != null && cp.price > 0) {
      prices.push(Number(cp.price));
    }

    competitorList.push({
      matchId: match.id, // Include product_matches.id for delete operations
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

  console.log("[getProductWithCompetitors] Built competitor list:", competitorList.length);

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




