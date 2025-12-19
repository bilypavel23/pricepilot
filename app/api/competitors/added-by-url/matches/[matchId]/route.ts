import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;

    if (!matchId) {
      return NextResponse.json(
        { error: "Match ID is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_ERROR" },
        { status: 401 }
      );
    }

    // Get or create store
    const store = await getOrCreateStore();

    // Verify store belongs to user
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Store does not belong to user", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Verify the match exists and belongs to this store
    const { data: match, error: matchError } = await supabaseAdmin
      .from("product_matches")
      .select("id, store_id")
      .eq("id", matchId)
      .eq("store_id", store.id)
      .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: "Match not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Delete the match
    const { error: deleteError } = await supabaseAdmin
      .from("product_matches")
      .delete()
      .eq("id", matchId)
      .eq("store_id", store.id);

    if (deleteError) {
      console.error("[delete-match] Error deleting match:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete match", code: "SERVER_ERROR" },
        { status: 500 }
      );
    }

    console.log("[delete-match] Successfully deleted match:", { matchId, storeId: store.id });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[delete-match] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

