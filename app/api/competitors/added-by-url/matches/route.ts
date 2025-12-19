import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_ERROR" },
        { status: 401 }
      );
    }

    // Get or create store
    const store = await getOrCreateStore();

    // Verify store belongs to user
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Store does not belong to user", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Query matches for URL-added competitors
    // Step 1: Get all product_matches for this store
    const { data: allMatches, error: allMatchesError } = await supabaseAdmin
      .from("product_matches")
      .select("id, product_id, competitor_product_id, store_id")
      .eq("store_id", store.id);

    if (allMatchesError) {
      console.error("[added-by-url-matches] Error loading matches:", allMatchesError);
      return NextResponse.json(
        { error: "Failed to load matches", code: "SERVER_ERROR", details: allMatchesError.message },
        { status: 500 }
      );
    }

    if (!allMatches || allMatches.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Step 2: Get product IDs and fetch products
    const productIds = [...new Set(allMatches.map((m: any) => m.product_id).filter((id: any) => id))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, store_id")
      .in("id", productIds)
      .eq("store_id", store.id);

    if (productsError) {
      console.error("[added-by-url-matches] Error loading products:", productsError);
      return NextResponse.json(
        { error: "Failed to load products", code: "SERVER_ERROR", details: productsError.message },
        { status: 500 }
      );
    }

    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    // Step 3: Get competitor_product IDs and fetch competitor_products
    const competitorProductIds = [
      ...new Set(allMatches.map((m: any) => m.competitor_product_id).filter((id: any) => id)),
    ];
    const { data: competitorProducts, error: cpError } = await supabaseAdmin
      .from("competitor_products")
      .select("id, name, url, price, competitor_id")
      .in("id", competitorProductIds);

    if (cpError) {
      console.error("[added-by-url-matches] Error loading competitor products:", cpError);
      return NextResponse.json(
        { error: "Failed to load competitor products", code: "SERVER_ERROR", details: cpError.message },
        { status: 500 }
      );
    }

    const competitorProductMap = new Map((competitorProducts || []).map((cp: any) => [cp.id, cp]));

    // Step 4: Get competitor IDs and fetch competitors (filter for URL-added only)
    const competitorIds = [
      ...new Set(
        (competitorProducts || [])
          .map((cp: any) => cp.competitor_id)
          .filter((id: any) => id)
      ),
    ];

    if (competitorIds.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const { data: competitors, error: competitorsError } = await supabaseAdmin
      .from("competitors")
      .select("id, domain, is_tracked, source, name")
      .in("id", competitorIds)
      .or("is_tracked.eq.false,source.eq.product_url");

    if (competitorsError) {
      console.error("[added-by-url-matches] Error loading competitors:", competitorsError);
      return NextResponse.json(
        { error: "Failed to load competitors", code: "SERVER_ERROR", details: competitorsError.message },
        { status: 500 }
      );
    }

    // Create a map of competitor_id -> competitor for quick lookup
    const competitorMap = new Map((competitors || []).map((c: any) => [c.id, c]));

    // Step 5: Filter matches to only include URL-added competitors and merge data
    const urlCompetitorIds = new Set((competitors || []).map((c: any) => c.id));

    const matches = allMatches
      .filter((m: any) => {
        const cp = competitorProductMap.get(m.competitor_product_id);
        return cp && urlCompetitorIds.has(cp.competitor_id);
      })
      .map((m: any) => {
        const product = productMap.get(m.product_id);
        const competitorProduct = competitorProductMap.get(m.competitor_product_id);
        const competitor = competitorMap.get(competitorProduct?.competitor_id);

        return {
          match: m,
          product,
          competitorProduct,
          competitor,
        };
      })
      .filter((m: any) => m.product && m.competitorProduct); // Ensure we have all required data

    if (matches.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Transform to response format
    const formattedMatches = matches
      .map((item: any) => {
        const { match, product, competitorProduct, competitor } = item;

        return {
          matchId: match.id,
          productId: product?.id,
          productName: product?.name || "Unnamed product",
          productSku: product?.sku || null,
          competitorProductId: competitorProduct?.id,
          competitorUrl: competitorProduct?.url,
          competitorName: competitorProduct?.name || "Unnamed product",
          competitorDomain: competitor?.domain || competitor?.name || "Unknown",
          competitorPrice: competitorProduct?.price || null,
        };
      })
      .sort((a: any, b: any) => {
        // Sort by productName asc, then domain asc
        const nameCompare = (a.productName || "").localeCompare(b.productName || "");
        if (nameCompare !== 0) return nameCompare;
        return (a.competitorDomain || "").localeCompare(b.competitorDomain || "");
      });

    return NextResponse.json({ matches: formattedMatches });
  } catch (err: any) {
    console.error("[added-by-url-matches] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

