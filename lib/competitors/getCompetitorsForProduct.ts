import type { SupabaseClient } from "@supabase/supabase-js";

export interface CompetitorForProduct {
  // Common fields
  competitorName: string;
  competitorUrl: string | null;
  competitorPrice: number | null; // last_price from DB
  lastChecked: string | null; // last_checked_at
  currency: string | null;
  type: "store" | "url"; // normalized type
  source: "Store" | "URL"; // display source
  
  // Store competitor fields (null for URL competitors)
  competitorId: string | null;
  competitorProductId: string | null;
  
  // For UI identification
  matchId: string; // For delete operations: "match-${competitor_id}" or "url-${competitor_url}"
}

export interface GetCompetitorsResult {
  competitors: CompetitorForProduct[];
  storeCompetitors: CompetitorForProduct[];
  urlCompetitors: CompetitorForProduct[];
}

/**
 * Get competitors for a single product, using the same data sources as Recommendations.
 * Queries competitor_product_matches (Store competitors) and competitor_url_products (URL competitors).
 * 
 * @param supabase - Supabase client instance
 * @param storeId - Store ID
 * @param productId - Product ID
 * @returns Unified competitors list with Store and URL competitors combined
 */
export async function getCompetitorsForProduct(
  supabase: SupabaseClient<any, "public", any>,
  storeId: string,
  productId: string
): Promise<GetCompetitorsResult> {
  const storeCompetitors: CompetitorForProduct[] = [];
  const urlCompetitors: CompetitorForProduct[] = [];

  try {
    // 1) Query competitor_product_matches (Store competitors) - same query as Recommendations
    const { data: matches, error: matchesError } = await supabase
      .from("competitor_product_matches")
      .select("product_id, competitor_id, competitor_product_id, competitor_name, competitor_url, last_price, currency, last_checked_at, created_at")
      .eq("store_id", storeId)
      .eq("product_id", productId);

    if (matchesError) {
      console.error("[getCompetitorsForProduct] Error querying competitor_product_matches:", matchesError);
    } else {
      const matchesRows = matches ?? [];
      for (const row of matchesRows) {
        const competitorPrice = row.last_price != null ? Number(row.last_price) : null;
        const matchId = row.competitor_id ? `match-${row.competitor_id}` : `url-${row.competitor_url}`;

        storeCompetitors.push({
          competitorName: row.competitor_name ?? "Competitor Store",
          competitorUrl: row.competitor_url ?? null,
          competitorPrice,
          lastChecked: row.last_checked_at || null,
          currency: row.currency ?? null,
          type: "store",
          source: "Store",
          competitorId: row.competitor_id || null,
          competitorProductId: row.competitor_product_id || null,
          matchId,
        });
      }
    }

    // 2) Query competitor_url_products (URL competitors) - same query as Recommendations
    const { data: urlRows, error: urlRowsError } = await supabase
      .from("competitor_url_products")
      .select("product_id, competitor_url, competitor_name, last_price, currency, last_checked_at, created_at")
      .eq("store_id", storeId)
      .eq("product_id", productId);

    if (urlRowsError) {
      console.error("[getCompetitorsForProduct] Error querying competitor_url_products:", urlRowsError);
    } else {
      const urlCompetitorRows = urlRows ?? [];
      for (const row of urlCompetitorRows) {
        const competitorPrice = row.last_price != null ? Number(row.last_price) : null;
        const matchId = `url-${row.competitor_url}`;

        urlCompetitors.push({
          competitorName: row.competitor_name ?? "Competitor URL",
          competitorUrl: row.competitor_url || null,
          competitorPrice,
          lastChecked: row.last_checked_at || null,
          currency: row.currency || "USD",
          type: "url",
          source: "URL",
          competitorId: null,
          competitorProductId: null,
          matchId,
        });
      }
    }

    // 3) Combine into unified list (Store first, then URL)
    const competitors = [...storeCompetitors, ...urlCompetitors];

    // Sort by price (ascending, nulls last)
    competitors.sort((a, b) => {
      if (a.competitorPrice == null && b.competitorPrice == null) return 0;
      if (a.competitorPrice == null) return 1;
      if (b.competitorPrice == null) return -1;
      return a.competitorPrice - b.competitorPrice;
    });

    return {
      competitors,
      storeCompetitors,
      urlCompetitors,
    };
  } catch (err) {
    console.error("[getCompetitorsForProduct] Exception loading competitors:", err);
    return {
      competitors: [],
      storeCompetitors: [],
      urlCompetitors: [],
    };
  }
}

