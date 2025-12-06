import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's store to verify ownership
    const store = await getOrCreateStore();

    // Ensure competitor belongs to the user's store
    const { data: competitor, error: competitorError } = await supabase
      .from("competitors")
      .select("id, store_id")
      .eq("id", competitorId)
      .single();

    if (competitorError || !competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    // Verify competitor belongs to user's store
    if (competitor.store_id !== store.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete competitor - FK constraints with ON DELETE CASCADE should clean related data
    const { error: deleteError } = await supabase
      .from("competitors")
      .delete()
      .eq("id", competitorId);

    if (deleteError) {
      console.error("Error deleting competitor:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/competitors/[competitorId]:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

