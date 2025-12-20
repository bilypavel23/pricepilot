import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Helper to ensure JSON response with proper headers
function jsonResponse(
  data: { error: string; code?: string; details?: Record<string, any> } | { ok: boolean },
  status: number = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  try {
    const { id: productId, matchId } = await params;

    if (!productId || !matchId) {
      return jsonResponse({
        error: "Product ID and Match ID are required",
        code: "VALIDATION_ERROR"
      }, 400);
    }

    // Create auth client to verify ownership
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({
        error: "Unauthorized",
        code: "AUTH_ERROR"
      }, 401);
    }

    // Verify product exists and belongs to user's store
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return jsonResponse({
        error: "Product not found",
        code: "NOT_FOUND"
      }, 404);
    }

    // Verify store belongs to user
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", product.store_id)
      .eq("owner_id", user.id)
      .single();

    if (storeError || !store) {
      return jsonResponse({
        error: "Unauthorized: Store does not belong to user",
        code: "FORBIDDEN"
      }, 403);
    }

    // Verify the match exists and belongs to this product
    const { data: match, error: matchError } = await supabaseAdmin
      .from("product_matches")
      .select("id, product_id, store_id")
      .eq("id", matchId)
      .eq("product_id", productId)
      .eq("store_id", store.id)
      .single();

    if (matchError || !match) {
      return jsonResponse({
        error: "Match not found",
        code: "NOT_FOUND"
      }, 404);
    }

    // Delete the match using admin client (ownership already verified)
    const { error: deleteError } = await supabaseAdmin
      .from("product_matches")
      .delete()
      .eq("id", matchId)
      .eq("product_id", productId)
      .eq("store_id", store.id);

    if (deleteError) {
      console.error("[delete-competitor] Error deleting match:", deleteError);
      return jsonResponse({
        error: deleteError.message || "Failed to delete competitor match",
        code: "SERVER_ERROR"
      }, 500);
    }

    console.log("[delete-competitor] Successfully deleted match:", { matchId, productId, storeId: store.id });

    return jsonResponse({ ok: true });
  } catch (err: any) {
    console.error("[delete-competitor] Unexpected error:", err);
    return jsonResponse({
      error: err?.message || "An unexpected error occurred",
      code: "SERVER_ERROR"
    }, 500);
  }
}


