import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
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

    const body = await req.json();
    const { status, competitor_product_id } = body;

    // Build update object
    const updateData: Record<string, any> = {};
    if (status) {
      updateData.status = status;
    }
    if (competitor_product_id) {
      updateData.competitor_product_id = competitor_product_id;
      // When changing competitor product, also set status to pending and update timestamp
      updateData.status = "pending";
      updateData.updated_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Verify the match belongs to user's store
    const { data: match, error: matchError } = await supabase
      .from("product_matches")
      .select("store_id")
      .eq("id", id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Verify store belongs to user
    const { data: store } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", match.store_id)
      .single();

    if (!store || store.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the match
    const { error: updateError } = await supabase
      .from("product_matches")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating match:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in PATCH /api/product-matches/[id]:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

