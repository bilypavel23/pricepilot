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

  // 2) Load confirmed matches from competitor_product_matches (for competitor store catalog)
  const { data: matches, error: matchesError } = await supabase
    .from("competitor_product_matches")
    .select("id, competitor_product_id")
    .eq("product_id", productId);

  if (matchesError) {
    console.error("[getProductWithCompetitors] Error loading matches:", matchesError);
  }

  // 3) Load URL competitors from competitor_url_products (for "Added by URL")
  const { data: urlCompetitors, error: urlCompetitorsError } = await supabase
    .from("competitor_url_products")
    .select("id, competitor_url, competitor_name, last_price, currency, last_checked_at")
    .eq("product_id", productId)
    .eq("store_id", storeId);

  if (urlCompetitorsError) {
    console.error("[getProductWithCompetitors] Error loading URL competitors:", urlCompetitorsError);
  }

  // 4) Load competitor_products using the competitor_product_ids from matches (if any)
  let competitorProducts: any[] = [];
  let competitorsMap = new Map();

  if (matches && matches.length > 0) {
    const competitorProductIds = matches
      .map((m) => m.competitor_product_id)
      .filter(Boolean);
    
    if (competitorProductIds.length > 0) {
      const { data: cpData, error: cpError } = await supabase
        .from("competitor_products")
        .select("id, title, url, price, competitor_id")
        .in("id", competitorProductIds);

      if (cpError) {
        console.error("[getProductWithCompetitors] Error loading competitor_products:", cpError);
      } else {
        competitorProducts = cpData ?? [];
      }

      // Load competitor store info separately
      const competitorIds = [...new Set(competitorProducts.map((cp) => cp.competitor_id).filter(Boolean))];

      if (competitorIds.length > 0) {
        const { data: competitors } = await supabase
          .from("competitors")
          .select("id, name, url, last_sync_at")
          .in("id", competitorIds);
        
        if (competitors) {
          competitorsMap = new Map(competitors.map((c) => [c.id, c]));
        }
      }
    }
  }

  // 5) Build competitor list with prices
  const competitorList: ProductWithCompetitors["competitors"] = [];
  const prices: number[] = [];

  // Add competitor store catalog matches
  if (matches && matches.length > 0) {
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
        matchId: match.id,
        competitorId: competitor.id,
        competitorName: competitor.name,
        competitorUrl: competitor.url,
        competitorProductId: cp.id,
        competitorProductName: cp.title ?? null,
        competitorProductUrl: cp.url,
        competitorPrice: cp.price != null ? Number(cp.price) : null,
        lastSyncAt: competitor.last_sync_at,
      });
    }
  }

  // Add URL competitors (from competitor_url_products)
  const urlCompetitorsList = urlCompetitors ?? [];
  for (const urlComp of urlCompetitorsList) {
    if (urlComp.last_price != null && urlComp.last_price > 0) {
      prices.push(Number(urlComp.last_price));
    }

    // Extract domain from URL for competitor name
    let competitorName = urlComp.competitor_name || "Unknown";
    try {
      const urlObj = new URL(urlComp.competitor_url);
      const domain = urlObj.hostname.replace(/^www\./, "");
      competitorName = domain.split(".").slice(0, -1).join(".") || domain;
    } catch {
      // Use competitor_name if URL parsing fails
    }

    competitorList.push({
      matchId: urlComp.id, // Use competitor_url_products.id
      competitorId: `url-${urlComp.id}`, // Virtual ID for URL competitors
      competitorName: competitorName,
      competitorUrl: urlComp.competitor_url,
      competitorProductId: urlComp.id,
      competitorProductName: urlComp.competitor_name,
      competitorProductUrl: urlComp.competitor_url,
      competitorPrice: urlComp.last_price != null ? Number(urlComp.last_price) : null,
      lastSyncAt: urlComp.last_checked_at,
    });
  }

  console.log("[getProductWithCompetitors] Built competitor list:", competitorList.length, {
    storeMatches: matches?.length || 0,
    urlCompetitors: urlCompetitorsList.length,
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




