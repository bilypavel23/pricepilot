import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const storeId = competitor.store_id;

  // Step 1: Delete competitor_product_matches ONLY for this competitor_id + store_id
  // CRITICAL: Must filter by BOTH store_id AND competitor_id to avoid deleting other competitors' matches
  const { error: matchesDeleteError } = await supabaseAdmin
    .from("competitor_product_matches")
    .delete()
    .eq("store_id", storeId)
    .eq("competitor_id", competitorId);

  if (matchesDeleteError) {
    console.error("Error deleting competitor_product_matches:", JSON.stringify(matchesDeleteError, null, 2));
    // Continue anyway - competitor deletion should proceed
  } else {
    console.log(`[delete-competitor] Deleted competitor_product_matches for competitor_id=${competitorId}, store_id=${storeId}`);
  }

  // Step 2: Delete competitor_match_candidates ONLY for this competitor_id + store_id
  const { error: candidatesDeleteError } = await supabaseAdmin
    .from("competitor_match_candidates")
    .delete()
    .eq("store_id", storeId)
    .eq("competitor_id", competitorId);

  if (candidatesDeleteError) {
    console.error("Error deleting competitor_match_candidates:", JSON.stringify(candidatesDeleteError, null, 2));
    // Continue anyway - competitor deletion should proceed
  } else {
    console.log(`[delete-competitor] Deleted competitor_match_candidates for competitor_id=${competitorId}, store_id=${storeId}`);
  }

  // Step 3: Delete competitor_store_products (staging) ONLY for this competitor_id + store_id
  const { error: stagingDeleteError } = await supabaseAdmin
    .from("competitor_store_products")
    .delete()
    .eq("store_id", storeId)
    .eq("competitor_id", competitorId);

  if (stagingDeleteError) {
    console.error("Error deleting competitor_store_products:", JSON.stringify(stagingDeleteError, null, 2));
    // Continue anyway - competitor deletion should proceed
  } else {
    console.log(`[delete-competitor] Deleted competitor_store_products for competitor_id=${competitorId}, store_id=${storeId}`);
  }

  // Step 4: Delete competitor (RLS on competitors must allow delete for this store_id)
  // This should be last, as it may trigger CASCADE deletes if foreign keys are set up
  const { error: deleteError } = await supabase
    .from("competitors")
    .delete()
    .eq("id", competitorId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  console.log(`[delete-competitor] Successfully deleted competitor_id=${competitorId} and all related data`);

  return NextResponse.json({ success: true });
}

