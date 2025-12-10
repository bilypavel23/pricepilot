import { createClient } from "@/lib/supabase/server";
import type { ProductRecommendation, CompetitorSlot } from "./types";

export async function getRecommendationsForStore(storeId: string): Promise<ProductRecommendation[]> {
  const supabase = createClient();

  // 1) load products for this store
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("store_id", storeId)
    .eq("status", "active");

  if (productsError) {
    console.error("getRecommendationsForStore: products error", productsError);
    return [];
  }

  if (!products || products.length === 0) {
    // No products at all: return empty — the page will handle placeholder state.
    return [];
  }

  const productIds = products.map((p) => p.id);

  // 2) load product_matches for these products (only confirmed/auto_confirmed)
  // Handle empty productIds array
  let matches: any[] = [];
  let matchesError: any = null;

  if (productIds.length > 0) {
    try {
      const { data: matchesData, error: matchesErr } = await supabase
        .from("product_matches")
        .select("product_id, competitor_product_id, match_score, status")
        .eq("store_id", storeId)
        .in("product_id", productIds)
        .in("status", ["confirmed", "auto_confirmed"]);

      if (matchesErr) {
        console.error("getRecommendationsForStore: matches error", JSON.stringify(matchesErr, null, 2));
        matchesError = matchesErr;
      } else {
        matches = matchesData ?? [];
      }
    } catch (err) {
      console.error("getRecommendationsForStore: matches exception", err);
      // Continue execution even if matches query fails - we'll just have no competitors
    }
  }

  const competitorProductIds = matches?.map((m) => m.competitor_product_id) ?? [];

  // 3) load competitor_products for these competitor_product_ids
  let competitorProductsMap = new Map<string, any>();
  if (competitorProductIds.length > 0) {
    const { data: competitorProducts, error: cpError } = await supabase
      .from("competitor_products")
      .select("id, name, price, url")
      .in("id", competitorProductIds);

    if (cpError) {
      console.error("getRecommendationsForStore: competitor_products error", cpError);
    } else if (competitorProducts) {
      competitorProductsMap = new Map(
        competitorProducts.map((cp) => [cp.id as string, cp])
      );
    }
  }

  const recommendations: ProductRecommendation[] = [];

  for (const p of products) {
    const productId = p.id as string;
    const productName = (p.name as string) ?? "Product name";
    const productPrice = (p.price ?? null) as number | null;

    const productMatches = (matches ?? []).filter(
      (m) => m.product_id === productId
    );

    let competitorAvg = 0;
    let competitorCount = 0;
    const competitorSlots: CompetitorSlot[] = [];

    if (productMatches.length > 0) {
      const prices: number[] = [];

      for (const m of productMatches) {
        const cp = competitorProductsMap.get(m.competitor_product_id);
        if (!cp || cp.price == null) continue;
        prices.push(Number(cp.price));
      }

      if (prices.length > 0) {
        competitorCount = prices.length;
        competitorAvg =
          prices.reduce((sum, v) => sum + v, 0) / prices.length;
      }
    }

    // Build up to 5 competitor slots
    const matchedCompetitors = (matches ?? [])
      .filter((m) => m.product_id === productId)
      .slice(0, 5);

    for (let i = 0; i < 5; i++) {
      const match = matchedCompetitors[i];
      if (!match) {
        competitorSlots.push({
          label: `Competitor ${i + 1}`,
        });
        continue;
      }

      const cp = competitorProductsMap.get(match.competitor_product_id);
      const newPrice = cp?.price != null ? Number(cp.price) : null;
      const oldPrice = null; // not tracked for now
      let changePercent: number | null = null;

      if (productPrice != null && newPrice != null && productPrice > 0) {
        // how far is competitor from my price
        changePercent = ((newPrice - productPrice) / productPrice) * 100;
      }

      competitorSlots.push({
        label: `Competitor ${i + 1}`,
        name: cp?.name ?? null,
        url: cp?.url ?? null,
        oldPrice,
        newPrice,
        changePercent,
      });
    }

    // Compute recommended price logic:
    // - CASE B (no competitors): recommendedPrice = productPrice, changePercent = 0
    // - CASE C (has competitors): recommendedPrice = competitorAvg (for now)
    let recommendedPrice: number | null = null;
    let changePercent = 0;
    let explanation = "";

    if (competitorCount === 0 || competitorAvg === 0 || productPrice == null) {
      // CASE B – no competitors or no usable data
      recommendedPrice = productPrice;
      changePercent = 0;
      explanation = "Add at least 1 competitor to unlock recommendations.";
      competitorAvg = 0;
    } else {
      // CASE C – there are competitors
      recommendedPrice = competitorAvg;
      changePercent = ((recommendedPrice - productPrice) / productPrice) * 100;

      if (changePercent > 0) {
        explanation = "Competitor prices are higher than yours.";
      } else if (changePercent < 0) {
        explanation = "Competitor prices are lower than yours.";
      } else {
        explanation = "Your price is aligned with competitors.";
      }
    }

    recommendations.push({
      productId,
      productName,
      productPrice,
      recommendedPrice,
      changePercent,
      competitorAvg,
      competitorCount,
      explanation,
      competitors: competitorSlots,
    });
  }

  return recommendations;
}

