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

  // 2) Load competitor_product_matches for these products (ONLY confirmed matches)
  // NO JOINS - only select product_id and competitor_product_id
  let matches: any[] = [];

  if (productIds.length > 0) {
    try {
      // Load confirmed matches from competitor_product_matches
      // Schema: columns are product_id and competitor_product_id (NOT my_product_id)
      // All rows in competitor_product_matches are confirmed by definition
      // DO NOT join to competitors - will filter by store_id in JS after loading competitor_products
      const { data: matchesData, error: matchesErr } = await supabase
        .from("competitor_product_matches")
        .select("product_id, competitor_product_id")
        .in("product_id", productIds);

      if (matchesErr) {
        console.error("getRecommendationsForStore: matches error", JSON.stringify(matchesErr, null, 2));
        matches = [];
      } else {
        matches = matchesData ?? [];
      }
    } catch (err) {
      console.error("getRecommendationsForStore: matches exception", err);
      // Continue execution even if matches query fails - we'll just have no competitors
      matches = [];
    }
  }

  const competitorProductIds = (matches ?? [])
    .map((m) => m.competitor_product_id)
    .filter(Boolean);

  // 3) Load competitor_products ONLY for matched competitor_product_ids
  // This includes competitor_id which we'll use to filter by store_id
  let competitorProductsMap = new Map<string, any>();
  let competitorIds = new Set<string>();
  
  if (competitorProductIds.length > 0) {
    const { data: competitorProducts, error: cpError } = await supabase
      .from("competitor_products")
      .select("id, title, price, url, competitor_id")
      .in("id", competitorProductIds);

    if (cpError) {
      console.error("getRecommendationsForStore: competitor_products error", JSON.stringify(cpError, null, 2));
    } else {
      const competitorProductsList = competitorProducts ?? [];
      // Build map and collect competitor_ids for filtering
      competitorProductsList.forEach((cp) => {
        competitorProductsMap.set(cp.id as string, cp);
        if (cp.competitor_id) {
          competitorIds.add(cp.competitor_id as string);
        }
      });
    }
  }

  // 4) Load competitors to filter by store_id
  // Build a map of competitor_id -> store_id, then filter matches in JS
  let validCompetitorIds = new Set<string>();
  if (competitorIds.size > 0) {
    const { data: competitors, error: compError } = await supabase
      .from("competitors")
      .select("id, store_id")
      .in("id", Array.from(competitorIds))
      .eq("store_id", storeId);

    if (compError) {
      console.error("getRecommendationsForStore: competitors error", JSON.stringify(compError, null, 2));
    } else {
      const competitorsList = competitors ?? [];
      competitorsList.forEach((c) => {
        validCompetitorIds.add(c.id as string);
      });
    }
  }

  // 5) Filter matches to only include those with valid competitor_ids (matching store_id)
  matches = (matches ?? []).filter((m) => {
    const cp = competitorProductsMap.get(m.competitor_product_id);
    if (!cp || !cp.competitor_id) return false;
    return validCompetitorIds.has(cp.competitor_id as string);
  });

  // 6) Load URL competitors from competitor_url_products for all products
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

    // Filter matches by product_id (NOT my_product_id)
    const productMatches = (matches ?? []).filter(
      (m) => m.product_id === productId
    );

    // Get URL competitors for this product
    const productUrlCompetitors = urlCompetitorsMap.get(productId) ?? [];

    let competitorAvg = 0;
    let competitorCount = 0;
    const competitorSlots: CompetitorSlot[] = [];
    const prices: number[] = [];

    // Add store competitors
    for (const m of productMatches) {
      const cp = competitorProductsMap.get(m.competitor_product_id);
      if (!cp || cp.price == null) continue;
      prices.push(Number(cp.price));
    }

    // Add URL competitors
    for (const uc of productUrlCompetitors) {
      if (uc.last_price != null && uc.last_price > 0) {
        prices.push(Number(uc.last_price));
      }
    }

    if (prices.length > 0) {
      competitorCount = prices.length;
      competitorAvg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
    }

    // Build up to 5 competitor slots (store + URL combined)
    const storeCompetitors = (matches ?? [])
      .filter((m) => m.product_id === productId)
      .slice(0, 5);
    
    const allCompetitors: Array<{ type: "store" | "url"; data: any; index: number }> = [];
    
    // Add store competitors
    storeCompetitors.forEach((match, idx) => {
      const cp = competitorProductsMap.get(match.competitor_product_id);
      if (cp) {
        allCompetitors.push({ type: "store", data: { match, cp }, index: idx });
      }
    });
    
    // Add URL competitors
    productUrlCompetitors.slice(0, 5 - allCompetitors.length).forEach((uc, idx) => {
      allCompetitors.push({ type: "url", data: uc, index: allCompetitors.length + idx });
    });

    // Sort by index and build slots
    allCompetitors.sort((a, b) => a.index - b.index);

    for (let i = 0; i < 5; i++) {
      const competitor = allCompetitors[i];
      if (!competitor) {
        competitorSlots.push({
          label: `Competitor ${i + 1}`,
        });
        continue;
      }

      if (competitor.type === "store") {
        const { match, cp } = competitor.data;
        const newPrice = cp.price != null ? Number(cp.price) : null;
        const oldPrice = null; // not tracked for now
        let changePercent: number | null = null;

        if (productPrice != null && newPrice != null && productPrice > 0) {
          changePercent = ((newPrice - productPrice) / productPrice) * 100;
        }

        competitorSlots.push({
          label: `Competitor ${i + 1}`,
          name: cp.title ?? null,
          url: cp.url ?? null,
          oldPrice,
          newPrice,
          changePercent,
          isUrlCompetitor: false,
        });
      } else {
        // URL competitor
        const uc = competitor.data;
        const newPrice = uc.last_price != null ? Number(uc.last_price) : null;
        const oldPrice = null;
        let changePercent: number | null = null;

        if (productPrice != null && newPrice != null && productPrice > 0) {
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

