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
  // RPC only takes p_store_id, we filter by competitor_id in the client
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
  // RPC get_competitor_products_for_store_matches returns flat rows with:
  // { competitor_id, product_id, product_name, product_sku, product_price, 
  //   competitor_product_id, competitor_product_name, competitor_product_url, 
  //   competitor_price, currency, similarity_score }
  // We need to:
  // 1. Filter by competitor_id === competitorId
  // 2. Group by product_id
  // 3. Create options array for each product group
  
  const filteredCandidates = Array.isArray(matchCandidates) 
    ? matchCandidates.filter((row: any) => row.competitor_id === competitorId)
    : [];

  // Group by product_id
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

  filteredCandidates.forEach((row: any) => {
    const productId = row.product_id;
    if (!productId) return;

    if (!productGroups.has(productId)) {
      productGroups.set(productId, {
        product_id: productId,
        product_name: row.product_name || "",
        product_sku: row.product_sku || null,
        product_price: row.product_price ?? null,
        options: [],
      });
    }

    const group = productGroups.get(productId)!;
    group.options.push({
      competitor_product_id: row.competitor_product_id || "",
      competitor_product_name: row.competitor_product_name || "",
      competitor_product_url: row.competitor_product_url || "",
      competitor_price: row.competitor_price ?? null,
      currency: row.currency || "USD",
      similarity_score: row.similarity_score || 0,
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

