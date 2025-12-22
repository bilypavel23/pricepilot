import { createClient } from "@/lib/supabase/server";
import type { ProductRecommendation, CompetitorSlot } from "./types";

export async function getRecommendationsForStore(storeId: string): Promise<ProductRecommendation[]> {
  const supabase = await createClient();

  // 1) Load products for this store
  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("store_id", storeId)
    .eq("status", "active");

  if (productsError) {
    console.error("getRecommendationsForStore: products error", productsError);
    return [];
  }

  const products = productsData ?? [];

  if (products.length === 0) {
    // No products at all: return empty — the page will handle placeholder state.
    return [];
  }

  const productIds = products.map((p) => p.id).filter(Boolean);

  // 2) Load tracked competitors using RPC get_recommendation_competitors
  // This RPC returns confirmed matches from competitor_product_matches
  // joined with competitor_store_products and competitors
  let competitorsByProduct = new Map<string, any[]>();

  if (productIds.length > 0) {
    try {
      const { data: competitorRows, error: rpcError } = await supabase.rpc(
        "get_recommendation_competitors",
        { p_store_id: storeId }
      );

      // Debug logs
      console.log("[reco] competitor rows", competitorRows?.length, competitorRows?.[0]);

      if (rpcError) {
        console.error("getRecommendationsForStore: RPC error", JSON.stringify(rpcError, null, 2));
      } else {
        const rows = competitorRows ?? [];
        
        // Group by product_id
        rows.forEach((row: any) => {
          const pid = row.product_id as string;
          if (!competitorsByProduct.has(pid)) {
            competitorsByProduct.set(pid, []);
          }
          competitorsByProduct.get(pid)!.push(row);
        });
      }
    } catch (err) {
      console.error("getRecommendationsForStore: RPC exception", err);
      // Continue execution even if RPC fails - we'll just have no competitors
    }
  }

  // 3) Load URL competitors from competitor_url_products for all products (fallback)
  // Recommendations should prefer confirmed matches, but keep URL competitors as fallback
  let urlCompetitorsMap = new Map<string, any[]>();
  if (productIds.length > 0) {
    const { data: urlCompetitors, error: urlError } = await supabase
      .from("competitor_url_products")
      .select("id, competitor_name, competitor_url, last_price, currency, product_id")
      .in("product_id", productIds)
      .eq("store_id", storeId);

    if (urlError) {
      console.error("getRecommendationsForStore: competitor_url_products error", JSON.stringify(urlError, null, 2));
    } else {
      const urlCompetitorsList = urlCompetitors ?? [];
      // Group by product_id
      urlCompetitorsList.forEach((uc) => {
        const pid = uc.product_id as string;
        if (!urlCompetitorsMap.has(pid)) {
          urlCompetitorsMap.set(pid, []);
        }
        urlCompetitorsMap.get(pid)!.push(uc);
      });
    }
  }

  const recommendations: ProductRecommendation[] = [];

  for (const p of products) {
    const productId = p.id as string;
    const productName = (p.name as string) ?? "Product name";
    const productPrice = (p.price ?? null) as number | null;

    // Get tracked competitors from RPC (confirmed matches)
    const trackedCompetitors = competitorsByProduct.get(productId) ?? [];
    
    // Get URL competitors for this product (fallback, only if no tracked competitors)
    const productUrlCompetitors = urlCompetitorsMap.get(productId) ?? [];

    // Debug log
    console.log("[reco] for product", productId, trackedCompetitors.length);

    let competitorAvg = 0;
    let competitorCount = 0;
    const competitorSlots: CompetitorSlot[] = [];
    const prices: number[] = [];

    // Add tracked competitors (from confirmed matches)
    for (const tc of trackedCompetitors) {
      const competitorPrice = tc.competitor_price != null ? Number(tc.competitor_price) : null;
      if (competitorPrice != null && competitorPrice > 0) {
        prices.push(competitorPrice);
      }
    }

    // Add URL competitors only if we have fewer than 5 tracked competitors
    // Recommendations should prefer confirmed matches
    const remainingSlots = Math.max(0, 5 - trackedCompetitors.length);
    for (const uc of productUrlCompetitors.slice(0, remainingSlots)) {
      if (uc.last_price != null && uc.last_price > 0) {
        prices.push(Number(uc.last_price));
      }
    }

    if (prices.length > 0) {
      competitorCount = prices.length;
      competitorAvg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
    }

    // Build up to 5 competitor slots (tracked first, then URL as fallback)
    const allCompetitors: Array<{ type: "tracked" | "url"; data: any; index: number }> = [];
    
    // Add tracked competitors (from confirmed matches)
    trackedCompetitors.slice(0, 5).forEach((tc, idx) => {
      allCompetitors.push({ type: "tracked", data: tc, index: idx });
    });
    
    // Add URL competitors only if we have fewer than 5 tracked
    productUrlCompetitors.slice(0, 5 - allCompetitors.length).forEach((uc, idx) => {
      allCompetitors.push({ type: "url", data: uc, index: allCompetitors.length + idx });
    });

    // Build slots
    for (let i = 0; i < 5; i++) {
      const competitor = allCompetitors[i];
      if (!competitor) {
        competitorSlots.push({
          label: `Competitor ${i + 1}`,
        });
        continue;
      }

      if (competitor.type === "tracked") {
        // Tracked competitor from confirmed matches
        const tc = competitor.data;
        const competitorPrice = tc.competitor_price != null ? Number(tc.competitor_price) : null;
        const oldPrice = null; // not tracked for now
        let changePercent: number | null = null;

        // Calculate percent change: ((competitorPrice - ourPrice) / ourPrice) * 100
        if (productPrice != null && productPrice > 0 && competitorPrice != null) {
          changePercent = ((competitorPrice - productPrice) / productPrice) * 100;
        }

        competitorSlots.push({
          label: `Competitor ${i + 1}`,
          name: tc.competitor_store_name ?? null, // Use competitor store name
          url: tc.competitor_url ?? null,
          oldPrice,
          newPrice: competitorPrice,
          changePercent,
          isUrlCompetitor: false,
        });
      } else {
        // URL competitor (fallback)
        const uc = competitor.data;
        const newPrice = uc.last_price != null ? Number(uc.last_price) : null;
        const oldPrice = null;
        let changePercent: number | null = null;

        if (productPrice != null && productPrice > 0 && newPrice != null) {
          changePercent = ((newPrice - productPrice) / productPrice) * 100;
        }

        competitorSlots.push({
          label: `Competitor ${i + 1}`,
          name: uc.competitor_name ?? null,
          url: uc.competitor_url ?? null,
          oldPrice,
          newPrice,
          changePercent,
          isUrlCompetitor: true,
        });
      }
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

