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
      _min_score: 15, // Default to 15 for better matches, can be adjusted
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
    
    // Ensure matchCandidates is an array (not count or single object)
    const candidatesData = Array.isArray(matchCandidates) ? matchCandidates : [];
    const candidates = candidatesData ?? [];
    
    // Log candidates before transformation
    console.log('[matches-review] candidates length:', candidates.length, 'first:', candidates[0]);

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
    // { candidate_id, store_id, competitor_id, product_id, product_name, product_sku, product_price,
    //   competitor_url, competitor_name, competitor_price, currency, similarity_score, last_checked_at }
    // RPC already sorts by similarity_score DESC and filters by >= _min_score
    // CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
    // - All candidate data comes from competitor_match_candidates (which contains full competitor fields)
    // - All persistent logic must rely on competitor_match_candidates and competitor_product_matches
    
    type RawRow = any;

    // Group by product_id (NOT candidate_id)
    const productGroups = new Map<string, {
      product_id: string;
      product_name: string;
      product_sku: string | null;
      product_price: number | null;
      max_similarity_score: number | null;
      candidates: Array<{
        candidate_id: string;
        competitor_product_id: string;
        competitor_url: string;
        competitor_name: string;
        competitor_last_price: number | null;
        competitor_currency: string | null;
        similarity_score: number;
      }>;
    }>();

    // Group by product_id from RPC
    candidates.forEach((row: RawRow) => {
      // Skip rows without product_id (unmatched candidates)
      if (!row.product_id) {
        return;
      }
      
      const productId = String(row.product_id);

      if (!productGroups.has(productId)) {
        productGroups.set(productId, {
          product_id: productId,
          product_name: row.product_name ?? "",
          product_sku: row.product_sku ?? null,
          product_price: row.product_price != null ? Number(row.product_price) : null,
          max_similarity_score: null,
          candidates: [],
        });
      }

      const group = productGroups.get(productId)!;
      
      // Map candidate fields exactly as specified
      const candidate = {
        candidate_id: String(row.candidate_id ?? row.id),
        competitor_product_id: row.competitor_product_id ?? "",
        competitor_url: row.competitor_url ?? "",
        competitor_name: row.competitor_name ?? "",
        competitor_last_price: row.competitor_last_price ?? row.last_price ?? row.competitor_price ?? null,
        competitor_currency: row.competitor_currency ?? row.currency ?? null,
        similarity_score: row.similarity_score != null ? Number(row.similarity_score) : 0,
      };
      
      // Convert price to number if it's a string
      if (candidate.competitor_last_price != null && typeof candidate.competitor_last_price === 'string') {
        candidate.competitor_last_price = Number(candidate.competitor_last_price) || null;
      }
      
      group.candidates.push(candidate);
      
      // Track max similarity_score for this product
      if (candidate.similarity_score != null && candidate.similarity_score > 0) {
        if (group.max_similarity_score == null || candidate.similarity_score > group.max_similarity_score) {
          group.max_similarity_score = candidate.similarity_score;
        }
      }
    });

    // Sort products by max similarity_score DESC, then sort candidates within each product by similarity_score DESC
    groupedMatches = Array.from(productGroups.values())
      .map((group) => {
        // Sort candidates by similarity_score DESC
        const sortedCandidates = group.candidates.sort((a, b) => b.similarity_score - a.similarity_score);
        
        return {
          product_id: group.product_id,
          product_name: group.product_name,
          product_sku: group.product_sku,
          product_price: group.product_price,
          max_similarity_score: group.max_similarity_score,
          candidates: sortedCandidates,
        };
      })
      .sort((a, b) => {
        // Sort products by max similarity_score DESC (nulls last)
        if (a.max_similarity_score === null && b.max_similarity_score === null) return 0;
        if (a.max_similarity_score === null) return 1;
        if (b.max_similarity_score === null) return -1;
        return b.max_similarity_score - a.max_similarity_score;
      });
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

