import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MatchesReviewClient } from "@/components/competitors/matches-review-client";

export const dynamic = "force-dynamic";

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

  // Step 1: Build match candidates first
  const buildPayload = {
    p_competitor_id: competitorId,
    p_store_id: store.id,
  };
  console.log("[matches-review] Building match candidates with payload:", {
    function: "build_match_candidates_for_competitor_store",
    payload: buildPayload,
  });

  const { error: buildError } = await supabase.rpc(
    "build_match_candidates_for_competitor_store",
    buildPayload
  );

  if (buildError) {
    console.error("[matches-review] Error building match candidates:", {
      competitorId,
      storeId: store.id,
      payload: buildPayload,
      message: buildError?.message || "Unknown error",
      code: buildError?.code || "NO_CODE",
      details: buildError?.details || null,
      hint: buildError?.hint || null,
      status: buildError?.status || null,
    });
    // Continue anyway - maybe candidates already exist
  }

  // Step 2: Load match candidates using RPC get_competitor_products_for_store_matches
  // Use 2-arg version with EXACT payload keys: p_store_id and p_competitor_id
  const loadPayload = {
    p_store_id: store.id,
    p_competitor_id: competitorId,
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
  const { data: myProducts, error: productsError } = await supabase
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

  // Transform match candidates for client
  // RPC get_competitor_products_for_store_matches returns flat rows with SQL field names:
  // { competitor_product_id, competitor_id, competitor_name, competitor_url, competitor_price, currency,
  //   suggested_product_id, similarity_score, store_product_name, store_product_sku, store_product_price }
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
      competitorProductId: r.competitor_product_id ?? r.competitor_product_id ?? r.id,
      competitorId: r.competitor_id ?? r.competitorId,
      competitorName: r.competitor_name ?? r.competitorName ?? r.name ?? "",
      competitorUrl: r.competitor_url ?? r.competitorUrl ?? r.url ?? "",
      competitorPrice,
      currency: r.currency ?? r.competitor_currency ?? null,

      suggestedProductId: r.suggested_product_id ?? r.suggestedProductId ?? null,
      similarityScore: Number(score) || 0,

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
    // Use suggestedProductId if available, otherwise use competitorProductId to show each unmatched candidate separately
    const productId = row.suggestedProductId || `__candidate_${row.competitorProductId}__`;

    if (!productGroups.has(productId)) {
      productGroups.set(productId, {
        product_id: row.suggestedProductId || row.competitorProductId,
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
  const groupedMatches = Array.from(productGroups.values()).map((group) => ({
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

  // Derive error message from status if needed
  const errorMessage = (competitor.status === "error" || competitor.status === "failed")
    ? "An error occurred during competitor setup. Please try adding the competitor again." 
    : null;

  return (
    <MatchesReviewClient
      competitorId={competitorId}
      competitorName={competitor.name || competitor.url}
      competitorStatus={competitor.status}
      errorMessage={errorMessage}
      groupedMatches={groupedMatches}
      myProducts={myProducts || []}
    />
  );
}

