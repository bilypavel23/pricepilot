import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateStore } from "@/lib/store";

/**
 * POST /api/competitors/[competitorId]/matches/confirm
 * 
 * Confirms match candidates and creates product_competitors records
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

    // Filter out rows where user selected "None (skip)"
    // Filter: competitor_product_id and product_id must be valid UUIDs
    // Do NOT reject request if some rows are skipped; only require at least 1 valid row
    const confirmed = normalizedSelections.filter((s) => {
      const hasValidCompetitorId = s.competitor_product_id && UUID_REGEX.test(s.competitor_product_id);
      const hasValidProductId = s.product_id && s.product_id !== null && s.product_id !== "" && s.product_id !== "none" && s.product_id !== "__NONE__" && UUID_REGEX.test(s.product_id);
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

    // Validation query must check competitor_product_id against competitor_store_products
    // Filter by store_id and competitor_id, and id IN (sentIds)
    const competitorProductIds = confirmed.map((s) => s.competitor_product_id);
    
    // Use service role client to bypass RLS
    const { data: existing, error: validationError } = await supabaseAdmin
      .from("competitor_store_products")
      .select("id")
      .eq("store_id", finalStoreId)
      .eq("competitor_id", competitorId)
      .in("id", competitorProductIds);

    if (validationError) {
      console.error("Error validating competitor products:", {
        error: validationError,
        competitorId,
        storeId: finalStoreId,
        competitorProductIds: competitorProductIds,
      });
      return NextResponse.json(
        { error: "Failed to validate competitor products" },
        { status: 500 }
      );
    }

    // If existing.length !== confirmed.length => 400 with message "Invalid competitor product IDs"
    const receivedIds = existing?.map((p) => p.id) || [];
    const sentIds = competitorProductIds;
    const missingIds = sentIds.filter((id) => !receivedIds.includes(id));

    if (!existing || existing.length !== confirmed.length) {
      console.error("Invalid competitor product IDs validation failed:", {
        sentCount: confirmed.length,
        receivedCount: existing?.length || 0,
        missingIds: missingIds,
        competitorId,
        storeId: finalStoreId,
      });
      return NextResponse.json(
        { error: "Invalid competitor product IDs" },
        { status: 400 }
      );
    }

    // Insert confirmed matches into public.competitor_product_matches
    // columns: store_id, competitor_id, product_id, competitor_product_id
    const rows = confirmed.map((s) => ({
      store_id: finalStoreId,
      competitor_id: competitorId,
      competitor_product_id: s.competitor_product_id,
      product_id: s.product_id,
    }));

    // Upsert using unique index: (store_id, competitor_id, competitor_product_id)
    // Use the exact constraint name format: store_id,competitor_id,competitor_product_id
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from("competitor_product_matches")
      .upsert(rows, {
        onConflict: "store_id,competitor_id,competitor_product_id",
      })
      .select("id");

    if (insertError) {
      console.error("Error upserting competitor_product_matches:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to save matches" },
        { status: 500 }
      );
    }

    const finalInsertedCount = insertedData?.length || 0;

    // Optionally delete confirmed candidates for those competitor_product_id from competitor_match_candidates
    // Delete by store_id + competitor_product_id (not by suggested_product_id)
    const competitorProductIdsToDelete = confirmed.map((s) => s.competitor_product_id);
    
    if (competitorProductIdsToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("competitor_match_candidates")
        .delete()
        .eq("store_id", finalStoreId)
        .in("competitor_product_id", competitorProductIdsToDelete);

      if (deleteError) {
        console.error("Error deleting match candidates (non-fatal):", JSON.stringify(deleteError, null, 2));
        // Continue anyway - matches were already confirmed
      }
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

