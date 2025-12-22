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
    matchId: string; // For compatibility, can be competitor_id or url product id
    competitorId: string | null; // null for URL competitors
    competitorName: string;
    competitorUrl: string | null;
    competitorProductId: string | null; // null for URL competitors
    competitorProductName: string | null;
    competitorProductUrl: string | null;
    competitorPrice: number | null; // Use last_price ?? competitor_price
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

  // 2) Load competitors ONLY from v_product_competitor_links
  // This view contains both Store competitors (competitor_id set) and URL competitors (competitor_id null)
  // DO NOT read from competitor_product_matches, competitor_url_products, or competitor_products_view
  const { data: competitorLinks, error: linksError } = await supabase
    .from("v_product_competitor_links")
    .select("source, competitor_id, competitor_name, competitor_url, last_price, competitor_price, currency, last_checked_at")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .order("competitor_price", { ascending: true, nullsFirst: false }); // Order by competitor_price asc nulls last

  if (linksError) {
    console.error("[getProductWithCompetitors] Error loading competitors from v_product_competitor_links:", linksError);
    // Return empty competitors array, not error
  }

  // 3) Build competitor list with prices
  const competitorList: ProductWithCompetitors["competitors"] = [];
  const prices: number[] = [];

  const links = competitorLinks ?? [];
  
  for (const link of links) {
    // Use last_price ?? competitor_price for price
    const price = link.last_price ?? link.competitor_price;
    const competitorPrice = price != null ? Number(price) : null;

    if (competitorPrice != null && competitorPrice > 0) {
      prices.push(competitorPrice);
    }

    // For matchId, use competitor_id if available, otherwise generate a virtual ID
    // For URL competitors, we don't have a direct match ID, so we'll use a combination
    const matchId = link.competitor_id 
      ? `match-${link.competitor_id}` 
      : `url-${link.competitor_url}`;

    competitorList.push({
      matchId,
      competitorId: link.competitor_id || null, // null for URL competitors
      competitorName: link.competitor_name || "Unknown",
      competitorUrl: link.competitor_url || null,
      competitorProductId: link.competitor_id || null, // null for URL competitors (no product_id in view)
      competitorProductName: link.competitor_name || null,
      competitorProductUrl: link.competitor_url || null,
      competitorPrice,
      lastSyncAt: link.last_checked_at || null,
      source: (link.source as "Store" | "URL") || (link.competitor_id ? "Store" : "URL"),
    });
  }

  console.log("[getProductWithCompetitors] Built competitor list from v_product_competitor_links:", competitorList.length, {
    storeCompetitors: links.filter(l => l.competitor_id != null).length,
    urlCompetitors: links.filter(l => l.competitor_id == null).length,
  });

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




