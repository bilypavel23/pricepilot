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

  // Step 2: Load grouped match candidates using RPC
  const loadPayload = {
    p_store_id: store.id,
    p_competitor_id: competitorId,
  };
  console.log("[matches-review] Loading grouped match candidates with payload:", {
    function: "get_grouped_match_candidates",
    payload: loadPayload,
  });

  const { data: groupedCandidates, error: candidatesError } = await supabase.rpc(
    "get_grouped_match_candidates",
    loadPayload
  );

  if (candidatesError) {
    console.error("[matches-review] Error loading grouped match candidates:", {
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

  // Transform grouped candidates for client
  // RPC get_grouped_match_candidates returns array of:
  // { product_id, product_name, product_sku, product_price, candidates: [...] }
  // where candidates array contains:
  // { candidate_id, competitor_product_id, competitor_url, competitor_name, competitor_last_price, competitor_currency, similarity_score }
  const groupedMatches = Array.isArray(groupedCandidates) ? groupedCandidates.map((group: any) => ({
    product_id: group.product_id || "",
    product_name: group.product_name || "",
    product_sku: group.product_sku || null,
    product_price: group.product_price ?? null,
    candidates: Array.isArray(group.candidates) ? group.candidates.map((c: any) => ({
      candidate_id: c.candidate_id,
      competitor_product_id: c.competitor_product_id || "",
      competitor_url: c.competitor_url || "",
      competitor_name: c.competitor_name || "",
      competitor_last_price: c.competitor_last_price ?? null,
      competitor_currency: c.competitor_currency || "USD",
      similarity_score: c.similarity_score || 0,
    })) : [],
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
      groupedMatches={groupedMatches}
      myProducts={myProducts || []}
    />
  );
}

