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
  };
  console.log("[matches-review] Loading match candidates with payload:", {
    function: "get_competitor_products_for_store_matches",
    payload: loadPayload,
  });

  const { data: matchCandidates, error: candidatesError } = await supabase.rpc(
    "get_competitor_products_for_store_matches",
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
  // RPC get_competitor_products_for_store_matches returns different structure
  // Expected format: array with { id, competitor_product_id, my_product_id, score, title, url, price, currency, ... }
  const matches = Array.isArray(matchCandidates) ? matchCandidates
    .filter((mc: any) => mc.competitor_id === competitorId) // Filter by competitor
    .map((mc: any) => ({
      id: mc.id || mc.candidate_id,
      competitorProduct: {
        id: mc.competitor_product_id || mc.id,
        title: mc.title || "",
        url: mc.url || "",
        price: mc.price ?? null,
        currency: mc.currency || "USD",
      },
      suggestedMyProductId: mc.my_product_id || mc.product_id,
      similarityScore: mc.score || 0,
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

