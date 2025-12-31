import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateStore } from "@/lib/store";

/**
 * POST /api/competitors/[competitorId]/matches/confirm
 * 
 * Confirms match candidates and creates competitor_product_matches records.
 * 
 * Flow:
 * 1. Read selected candidates from competitor_match_candidates (with full competitor data)
 * 2. Copy full competitor data from competitor_match_candidates into competitor_product_matches
 * 3. Delete confirmed rows from competitor_match_candidates
 * 
 * CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
 * - All persistent logic must rely on: competitor_match_candidates and competitor_product_matches
 * - competitor_product_matches must be fully self-contained (no dependency on competitor_store_products)
 * - All competitor data (name, url, price, currency) is copied directly into competitor_product_matches
 * - Never read from competitor_store_products for persistent data
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
    const body = await req.json();
    
    // Support both camelCase and snake_case payload formats
    let { selections, storeId } = body as {
      selections?: Array<{ 
        competitor_product_id?: string; 
        product_id?: string;
        competitorProductId?: string;
        productId?: string | null;
      }>;
      storeId?: string;
    };

    // Normalize to snake_case
    const normalizedSelections = (selections || []).map((s) => ({
      competitor_product_id: s.competitor_product_id || s.competitorProductId,
      product_id: s.product_id || s.productId,
    }));

    // UUID regex for validation
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Filter out rows where user selected "None (skip)" (value is "__none__")
    // Filter: competitor_product_id and product_id must be valid UUIDs
    // Do NOT reject request if some rows are skipped; only require at least 1 valid row
    const confirmed = normalizedSelections.filter((s) => {
      const hasValidCompetitorId = s.competitor_product_id && 
        s.competitor_product_id !== "__none__" && 
        s.competitor_product_id !== "__NONE__" &&
        UUID_REGEX.test(s.competitor_product_id);
      const hasValidProductId = s.product_id && 
        s.product_id !== null && 
        s.product_id !== "" && 
        s.product_id !== "none" && 
        s.product_id !== "__none__" &&
        s.product_id !== "__NONE__" && 
        UUID_REGEX.test(s.product_id);
      return hasValidCompetitorId && hasValidProductId;
    });

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await getOrCreateStore();
    const finalStoreId = storeId || store.id;

    // Verify competitor belongs to user's store
    const { data: competitor, error: competitorError } = await supabase
      .from("competitors")
      .select("id, store_id")
      .eq("id", competitorId)
      .eq("store_id", finalStoreId)
      .single();

    if (competitorError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    // Do NOT reject request if some rows are skipped; only require at least 1 valid row to confirm
    if (confirmed.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    // Verify all products belong to user's store
    const myProductIds = confirmed.map((s) => s.product_id);
    const { data: myProducts, error: productsError } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", finalStoreId)
      .in("id", myProductIds);

    if (productsError || !myProducts || myProducts.length !== confirmed.length) {
      return NextResponse.json(
        { error: "Invalid product IDs" },
        { status: 400 }
      );
    }

    // Read full candidate data from competitor_match_candidates
    // NOTE: competitor_match_candidates contains full competitor fields:
    // competitor_id, competitor_name, competitor_url, competitor_price, currency, last_checked_at
    // We will copy ALL this data into competitor_product_matches (fully self-contained)
    const competitorProductIds = confirmed.map((s) => s.competitor_product_id);
    
    // Use service role client to bypass RLS
    // Load full candidate data from competitor_match_candidates
    // Filter by store_id, competitor_id, and competitor_product_id IN (selected)
    const { data: candidateData, error: validationError } = await supabaseAdmin
      .from("competitor_match_candidates")
      .select("competitor_product_id, competitor_id, competitor_name, competitor_url, competitor_price, currency, last_checked_at")
      .eq("store_id", finalStoreId)
      .eq("competitor_id", competitorId)
      .in("competitor_product_id", competitorProductIds);

    // Load last_price from competitor_store_products separately
    // Join key: store_id + competitor_id + id (where id = competitor_product_id)
    const { data: storeProductsData } = await supabaseAdmin
      .from("competitor_store_products")
      .select("id, last_price")
      .eq("store_id", finalStoreId)
      .eq("competitor_id", competitorId)
      .in("id", competitorProductIds);

    // Build map of competitor_product_id -> last_price
    const lastPriceMap = new Map(
      (storeProductsData || []).map((sp: any) => [sp.id, sp.last_price])
    );

    if (validationError) {
      console.error("Error loading candidate data:", {
        error: validationError,
        competitorId,
        storeId: finalStoreId,
        competitorProductIds: competitorProductIds,
      });
      return NextResponse.json(
        { error: "Failed to load candidate data" },
        { status: 500 }
      );
    }

    // Validate that all competitor_product_ids exist in competitor_match_candidates
    const receivedIds = candidateData?.map((p) => p.competitor_product_id) || [];
    const sentIds = competitorProductIds;
    const missingIds = sentIds.filter((id) => !receivedIds.includes(id));

    if (!candidateData || candidateData.length !== confirmed.length) {
      console.error("Invalid competitor product IDs validation failed:", {
        sentCount: confirmed.length,
        receivedCount: candidateData?.length || 0,
        missingIds: missingIds,
        competitorId,
        storeId: finalStoreId,
      });
      return NextResponse.json(
        { error: "Invalid competitor product IDs" },
        { status: 400 }
      );
    }

    // Build a map of competitor_product_id -> candidate data for quick lookup
    // Add last_price from competitor_store_products map
    const candidateMap = new Map(
      candidateData.map((c: any) => {
        const lastPrice = lastPriceMap.get(c.competitor_product_id) ?? null;
        return [c.competitor_product_id, { ...c, last_price: lastPrice }];
      })
    );

    // Copy full competitor data from competitor_match_candidates into competitor_product_matches
    // CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
    // - competitor_product_matches must be fully self-contained (no dependency on competitor_store_products)
    // - All persistent logic must rely on competitor_match_candidates and competitor_product_matches
    // - Use last_price from candidate (from competitor_store_products join) for future rows
    const matchRows = confirmed.map((s) => {
      const candidate = candidateMap.get(s.competitor_product_id);
      if (!candidate) {
        throw new Error(`Candidate data not found for ${s.competitor_product_id}`);
      }
      
      // Use last_price from candidate (from competitor_store_products) if available
      // Fallback to competitor_price if last_price is null
      const lastPrice = candidate.last_price ?? candidate.competitor_price ?? null;
      
      return {
        store_id: finalStoreId,
        competitor_id: competitorId,
        product_id: s.product_id,
        competitor_product_id: candidate.competitor_product_id,
        // Copy full competitor data directly into competitor_product_matches
        competitor_name: candidate.competitor_name,
        competitor_url: candidate.competitor_url,
        last_price: lastPrice, // Use last_price from competitor_store_products (via join)
        currency: candidate.currency || "USD",
        last_checked_at: candidate.last_checked_at || new Date().toISOString(),
      };
    });

    // Upsert using unique index: (store_id, competitor_id, product_id)
    // Try upsert first, fallback to delete+insert if constraint name doesn't match
    let insertedData: any[] | null = null;
    let insertError: any = null;
    
    try {
      const result = await supabaseAdmin
        .from("competitor_product_matches")
        .upsert(matchRows, {
          onConflict: "store_id,competitor_id,product_id",
        })
        .select("id");
      
      insertedData = result.data;
      insertError = result.error;
    } catch (upsertErr: any) {
      // Fallback: delete existing matches and insert new ones
      console.warn("Upsert failed, trying delete+insert:", upsertErr);
      
      // Delete existing matches for these products
      const productIdsToDelete = [...new Set(matchRows.map((r) => r.product_id))];
      await supabaseAdmin
        .from("competitor_product_matches")
        .delete()
        .eq("store_id", finalStoreId)
        .eq("competitor_id", competitorId)
        .in("product_id", productIdsToDelete);
      
      // Insert new matches
      const result = await supabaseAdmin
        .from("competitor_product_matches")
        .insert(matchRows)
        .select("id");
      
      insertedData = result.data;
      insertError = result.error;
    }

    if (insertError) {
      console.error("Error upserting competitor_product_matches:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to save matches" },
        { status: 500 }
      );
    }

    const finalInsertedCount = insertedData?.length || 0;

    // Step 1.5: Run one-time backfill to copy last_price into competitor_product_matches
    // This updates existing rows that have null last_price
    // Join by store_id + competitor_id + competitor_product_id (best key)
    // Use the product_ids from confirmed matches to backfill only relevant rows
    try {
      const productIdsForBackfill = confirmed.map((s) => s.product_id);
      
      // Get all competitor_product_matches rows for this store+competitor+products that need backfill
      const { data: matchesToBackfill } = await supabaseAdmin
        .from("competitor_product_matches")
        .select("competitor_product_id, last_price")
        .eq("store_id", finalStoreId)
        .eq("competitor_id", competitorId)
        .in("product_id", productIdsForBackfill)
        .is("last_price", null);

      if (matchesToBackfill && matchesToBackfill.length > 0) {
        // Get last_price from competitor_store_products for these competitor_product_ids
        const competitorProductIdsForBackfill = matchesToBackfill.map((m: any) => m.competitor_product_id);
        const { data: storeProductsForBackfill } = await supabaseAdmin
          .from("competitor_store_products")
          .select("id, last_price")
          .eq("store_id", finalStoreId)
          .eq("competitor_id", competitorId)
          .in("id", competitorProductIdsForBackfill)
          .not("last_price", "is", null);

        // Build map and update rows
        const backfillMap = new Map(
          (storeProductsForBackfill || []).map((sp: any) => [sp.id, sp.last_price])
        );

        // Update each row that needs backfill
        for (const match of matchesToBackfill) {
          const lastPrice = backfillMap.get(match.competitor_product_id);
          if (lastPrice != null) {
            await supabaseAdmin
              .from("competitor_product_matches")
              .update({ last_price: lastPrice })
              .eq("store_id", finalStoreId)
              .eq("competitor_id", competitorId)
              .eq("competitor_product_id", match.competitor_product_id);
          }
        }

        console.log(`[confirm] Backfill completed: updated ${backfillMap.size} rows with last_price`);
      }
    } catch (backfillErr: any) {
      console.warn("Backfill error (non-fatal):", backfillErr);
      // Continue anyway - backfill can be run manually via migration
    }

    // Step 2: Delete confirmed rows from competitor_match_candidates
    // Only delete the rows that were confirmed (not all candidates)
    const confirmedCompetitorProductIds = confirmed.map((s) => s.competitor_product_id);
    const { error: deleteError } = await supabaseAdmin
      .from("competitor_match_candidates")
      .delete()
      .eq("store_id", finalStoreId)
      .eq("competitor_id", competitorId)
      .in("competitor_product_id", confirmedCompetitorProductIds);

    if (deleteError) {
      console.error("Error deleting match candidates (non-fatal):", JSON.stringify(deleteError, null, 2));
      // Continue anyway - matches were already confirmed
    }

    // Optionally set competitors.last_sync_at and status='active'
    await supabaseAdmin
      .from("competitors")
      .update({ 
        status: "active",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", competitorId)
      .eq("store_id", finalStoreId);

    return NextResponse.json({
      ok: true,
      inserted: finalInsertedCount,
    });
  } catch (err: any) {
    console.error("Error in POST /api/competitors/[competitorId]/matches/confirm:", JSON.stringify(err, null, 2));
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

