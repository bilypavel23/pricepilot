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

  // Step 2: Load match candidates using RPC
  const loadPayload = {
    p_store_id: store.id,
    p_competitor_id: competitorId,
  };
  console.log("[matches-review] Loading match candidates with payload:", {
    function: "get_match_candidates_for_competitor_store",
    payload: loadPayload,
  });

  const { data: matchCandidates, error: candidatesError } = await supabase.rpc(
    "get_match_candidates_for_competitor_store",
    loadPayload
  );

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
  // RPC get_match_candidates_for_competitor_store returns:
  // candidate_id, competitor_product_id, competitor_url, competitor_name, competitor_last_price, competitor_currency,
  // suggested_product_id, suggested_product_name, suggested_product_sku, suggested_product_price, similarity_score
  const matches = Array.isArray(matchCandidates) ? matchCandidates.map((mc: any) => ({
    candidate_id: mc.candidate_id,
    competitor_product_id: mc.competitor_product_id,
    competitor_url: mc.competitor_url || "",
    competitor_name: mc.competitor_name || "",
    competitor_last_price: mc.competitor_last_price ?? null,
    competitor_currency: mc.competitor_currency || "USD",
    suggested_product_id: mc.suggested_product_id || "",
    suggested_product_name: mc.suggested_product_name || "",
    suggested_product_sku: mc.suggested_product_sku || null,
    suggested_product_price: mc.suggested_product_price ?? null,
    similarity_score: mc.similarity_score || 0,
  })) : [];

  // Derive error message from status if needed
  const errorMessage = competitor.status === "error" 
    ? "An error occurred during competitor setup. Please try adding the competitor again." 
    : null;

  return (
    <MatchesReviewClient
      competitorId={competitorId}
      competitorName={competitor.name || competitor.url}
      competitorStatus={competitor.status}
      errorMessage={errorMessage}
      matches={matches}
      myProducts={myProducts || []}
    />
  );
}

