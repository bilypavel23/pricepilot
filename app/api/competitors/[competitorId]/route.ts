import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Test GET endpoint to verify route is working
export async function GET(
  req: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  const { competitorId } = await params;
  return NextResponse.json({ message: "Route is working", competitorId });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  const { competitorId } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try to load competitor and ensure it belongs to one of the user's stores
  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("id, store_id")
    .eq("id", competitorId)
    .single();

  if (competitorError || !competitor) {
    // Competitor not found in DB or not visible due to RLS
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  // Verify competitor belongs to user's store
  const { data: store } = await supabase
    .from("stores")
    .select("id, owner_id")
    .eq("owner_id", user.id)
    .eq("id", competitor.store_id)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete competitor (RLS on competitors must allow delete for this store_id)
  const { error: deleteError } = await supabase
    .from("competitors")
    .delete()
    .eq("id", competitorId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

