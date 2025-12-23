import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MatchesReviewClient } from "@/components/competitors/matches-review-client";
import { MatchesTrackingClient } from "@/components/competitors/matches-tracking-client";
import { getMatchCountForCompetitor } from "@/lib/competitors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MatchesReviewPage({
  params,
}: {
  params: Promise<{ competitorId: string }>;
}) {
  const { competitorId } = await params;
  const { user, profile } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const store = await getOrCreateStore();

  const supabase = await createClient();

  // Load competitor store
  // Note: error_message column doesn't exist, so we don't select it
  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("id, name, url, status")
    .eq("id", competitorId)
    .eq("store_id", store.id)
    .single();

  if (competitorError || !competitor) {
    console.error("[matches-review] Error loading competitor:", {
      competitorId,
      storeId: store.id,
      message: competitorError?.message || "Unknown error",
      code: competitorError?.code || "NO_CODE",
      details: competitorError?.details || null,
      hint: competitorError?.hint || null,
      status: competitorError?.status || null,
    });
    redirect("/app/competitors");
  }

  // Determine mode based on confirmed matches count
  const confirmedCount = await getMatchCountForCompetitor(store.id, competitorId);
  const isTrackingMode = confirmedCount > 0;

  // REVIEW MODE: Only load candidates when confirmedCount === 0
  let groupedMatches: any[] = [];
  let myProducts: any[] = [];

  if (!isTrackingMode) {
    // REVIEW MODE: Load candidates using RPC get_competitor_products_for_store_matches
    // This RPC builds candidates (if missing) and returns them in one call.
    // DO NOT call any separate build RPC - this RPC handles everything automatically.
    
    // RPC get_competitor_products_for_store_matches:
    // - Checks if candidates exist in competitor_match_candidates
    // - If missing, automatically builds candidates from competitor_store_products
    // - Returns candidate data (name, price, url) from competitor_match_candidates
    // Use underscore prefix for payload keys if client library maps by name
    const loadPayload = {
      _store_id: store.id,
      _competitor_id: competitorId,
    };
    console.log("[matches-review] Loading match candidates with payload:", {
      function: "get_competitor_products_for_store_matches",
      payload: loadPayload,
    });

    const { data: matchCandidates, error: candidatesError } = await supabase.rpc(
      "get_competitor_products_for_store_matches",
      loadPayload
    );

    // Log the raw RPC response
    console.log("[matches-review] rpc error:", candidatesError);
    console.log("[matches-review] rpc data:", matchCandidates?.length, matchCandidates?.[0]);

    if (candidatesError) {
      console.error("[matches-review] Error loading match candidates:", {
        competitorId,
        storeId: store.id,
        payload: loadPayload,
        message: candidatesError?.message || "Unknown error",
        code: candidatesError?.code || "NO_CODE",
        details: candidatesError?.details || null,
        hint: candidatesError?.hint || null,
        status: candidatesError?.status || null,
      });
    }

    // Load my products for dropdown
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku, price")
      .eq("store_id", store.id)
      .eq("is_demo", false)
      .order("name");

    if (productsError) {
      console.error("[matches-review] Error loading products:", {
        competitorId,
        storeId: store.id,
        message: productsError?.message || "Unknown error",
        code: productsError?.code || "NO_CODE",
        details: productsError?.details || null,
        hint: productsError?.hint || null,
        status: productsError?.status || null,
      });
    }

    myProducts = productsData || [];

    // Transform match candidates for client
    // RPC get_competitor_products_for_store_matches returns flat rows with SQL field names:
    // { competitor_product_id, competitor_id, competitor_name, competitor_url, competitor_price, currency,
    //   suggested_product_id, similarity_score, store_product_id, store_product_name, store_product_sku, store_product_price }
    // CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
    // - All candidate data comes from competitor_match_candidates (which contains full competitor fields)
    // - All persistent logic must rely on competitor_match_candidates and competitor_product_matches
    // Normalize and map to internal structure
    
    type RawRow = any;

    function normalizeRow(r: RawRow) {
      const score =
        r.similarity_score ??
        r.match_score ??
        r.similarity ??
        r.score ??
        0;

      const competitorPrice =
        r.competitor_price ??
        r.last_price ??
        r.price ??
        null;

      return {
        competitorProductId: r.competitor_product_id ?? r.id,
        competitorId: r.competitor_id ?? r.competitorId,
        competitorName: r.competitor_name ?? r.competitorName ?? r.name ?? "",
        competitorUrl: r.competitor_url ?? r.competitorUrl ?? r.url ?? "",
        competitorPrice,
        currency: r.currency ?? r.competitor_currency ?? "USD",

        suggestedProductId: r.suggested_product_id ?? r.suggestedProductId ?? null,
        similarityScore: Number(score) || 0,

        storeProductId: r.store_product_id ?? r.storeProductId ?? null,
        storeProductName: r.store_product_name ?? r.storeProductName ?? "",
        storeProductSku: r.store_product_sku ?? r.storeProductSku ?? "",
        storeProductPrice: r.store_product_price ?? r.storeProductPrice ?? null,
      };
    }

    // Map SQL fields to internal structure using normalizeRow
    const rows = (Array.isArray(matchCandidates) ? matchCandidates : []).map(normalizeRow);

    // Group by suggested_product_id (my product)
    const productGroups = new Map<string, {
      product_id: string;
      product_name: string;
      product_sku: string | null;
      product_price: number | null;
      options: Array<{
        competitor_product_id: string;
        competitor_product_name: string;
        competitor_product_url: string;
        competitor_price: number | null;
        currency: string;
        similarity_score: number;
      }>;
    }>();

    // Group by suggestedProductId (keep rows even when suggestedProductId is null)
    // For rows without suggestedProductId, show each candidate as its own row
    rows.forEach((row) => {
      // Use suggestedProductId if available, otherwise use storeProductId, otherwise use competitorProductId to show each unmatched candidate separately
      const productId = row.suggestedProductId || row.storeProductId || `__candidate_${row.competitorProductId}__`;

      if (!productGroups.has(productId)) {
        productGroups.set(productId, {
          product_id: row.suggestedProductId || row.storeProductId || row.competitorProductId,
          product_name: row.storeProductName || "",
          product_sku: row.storeProductSku || null,
          product_price: row.storeProductPrice ?? null,
          options: [],
        });
      }

      const group = productGroups.get(productId)!;
      group.options.push({
        competitor_product_id: row.competitorProductId || "",
        competitor_product_name: row.competitorName || "",
        competitor_product_url: row.competitorUrl || "",
        competitor_price: row.competitorPrice ?? null,
        currency: row.currency || "USD",
        similarity_score: row.similarityScore || 0,
      });
    });

    // Convert to array and sort options by similarity_score descending
    groupedMatches = Array.from(productGroups.values()).map((group) => ({
      product_id: group.product_id,
      product_name: group.product_name,
      product_sku: group.product_sku,
      product_price: group.product_price,
      candidates: group.options.sort((a, b) => b.similarity_score - a.similarity_score).map((opt) => ({
        candidate_id: opt.competitor_product_id,
        competitor_product_id: opt.competitor_product_id,
        competitor_url: opt.competitor_product_url,
        competitor_name: opt.competitor_product_name,
        competitor_last_price: opt.competitor_price,
        competitor_currency: opt.currency,
        similarity_score: opt.similarity_score,
      })),
    }));
  }

  // Derive error message from status if needed
  const errorMessage = (competitor.status === "error" || competitor.status === "failed")
    ? "An error occurred during competitor setup. Please try adding the competitor again." 
    : null;

  // TRACKING MODE: Load tracked products from competitor_product_matches
  if (isTrackingMode) {
    // Query competitor_product_matches directly
    // CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
    // - competitor_product_matches is fully self-contained (no dependency on competitor_store_products)
    // - All competitor data (name, url, price, currency) is stored directly in competitor_product_matches
    // - All persistent logic must rely on competitor_match_candidates and competitor_product_matches
    const { data: matchesData, error: matchesError } = await supabase
      .from("competitor_product_matches")
      .select("product_id, competitor_product_id, competitor_name, competitor_url, competitor_price, currency")
      .eq("store_id", store.id)
      .eq("competitor_id", competitorId);

    if (matchesError) {
      console.error("[matches-tracking] Error loading tracked products:", {
        competitorId,
        storeId: store.id,
        error: matchesError,
      });
    }

    // Load products separately (for store product info)
    const productIds = (matchesData || []).map((m: any) => m.product_id).filter(Boolean);
    let productsMap = new Map<string, any>();

    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, sku, price")
        .eq("store_id", store.id)
        .in("id", productIds);
      
      if (productsData) {
        productsData.forEach((p: any) => {
          productsMap.set(p.id, p);
        });
      }
    }

    // Transform to tracking format
    // All competitor data comes directly from competitor_product_matches (fully self-contained)
    const trackedProducts = (matchesData || []).map((row: any) => {
      const product = productsMap.get(row.product_id);
      
      return {
        store_product_id: row.product_id,
        store_product_name: product?.name || "",
        store_product_sku: product?.sku || null,
        store_product_price: product?.price ?? null,
        competitor_product_id: row.competitor_product_id,
        competitor_name: row.competitor_name || "",
        competitor_url: row.competitor_url || "",
        competitor_price: row.competitor_price ?? null,
        currency: row.currency || "USD",
      };
    });

    return (
      <MatchesTrackingClient
        competitorId={competitorId}
        competitorName={competitor.name || competitor.url}
        trackedProducts={trackedProducts}
      />
    );
  }

  // REVIEW MODE: Show candidates with dropdown and confirm button
  return (
    <MatchesReviewClient
      competitorId={competitorId}
      competitorName={competitor.name || competitor.url}
      competitorStatus={competitor.status}
      errorMessage={errorMessage}
      groupedMatches={groupedMatches}
      myProducts={myProducts || []}
      storeId={store.id}
    />
  );
}

