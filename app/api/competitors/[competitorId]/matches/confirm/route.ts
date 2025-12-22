import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const { matches } = body as {
      matches: Array<{ product_id: string; competitor_product_id: string }>;
    };

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await getOrCreateStore();

    // Verify competitor belongs to user's store
    const { data: competitor, error: competitorError } = await supabase
      .from("competitors")
      .select("id, store_id")
      .eq("id", competitorId)
      .eq("store_id", store.id)
      .single();

    if (competitorError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { error: "No matches provided" },
        { status: 400 }
      );
    }

    // Verify all products belong to user's store
    const myProductIds = matches.map((m) => m.product_id);
    const { data: myProducts, error: productsError } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", store.id)
      .in("id", myProductIds);

    if (productsError || !myProducts || myProducts.length !== matches.length) {
      return NextResponse.json(
        { error: "Invalid product IDs" },
        { status: 400 }
      );
    }

    // Verify all competitor products belong to this competitor (from competitor_store_products)
    const competitorProductIds = matches.map((m) => m.competitor_product_id);
    const { data: competitorProducts, error: competitorProductsError } = await supabase
      .from("competitor_store_products")
      .select("id, competitor_id, competitor_url, last_price, currency")
      .in("id", competitorProductIds)
      .eq("competitor_id", competitorId)
      .eq("store_id", store.id);

    if (competitorProductsError || !competitorProducts || competitorProducts.length !== matches.length) {
      return NextResponse.json(
        { error: "Invalid competitor product IDs" },
        { status: 400 }
      );
    }

    // Create competitor_product_matches records
    // Table structure: store_id, product_id, competitor_product_id
    const matchesToInsert = matches.map((match) => ({
      store_id: store.id,
      product_id: match.product_id,
      competitor_product_id: match.competitor_product_id,
    }));

    // Insert competitor_product_matches (upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from("competitor_product_matches")
      .upsert(matchesToInsert, {
        onConflict: "store_id,product_id,competitor_product_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Error inserting competitor_product_matches:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to save matches" },
        { status: 500 }
      );
    }

    // Delete match candidates for confirmed matches
    // Since competitor_match_candidates doesn't have competitor_id, we filter via competitor_product_id
    // which we've already verified belongs to this competitor
    const competitorProductIdsToDelete = matches.map((m) => m.competitor_product_id);
    const productIdsToDelete = matches.map((m) => m.product_id);
    
    if (competitorProductIdsToDelete.length > 0 && productIdsToDelete.length > 0) {
      // Delete candidates where suggested_product_id AND competitor_product_id match
      // We need to delete each combination individually since Supabase doesn't support
      // deleting with multiple IN conditions easily
      const deletePromises = matches.map((match) =>
        supabase
          .from("competitor_match_candidates")
          .delete()
          .eq("store_id", store.id)
          .eq("suggested_product_id", match.product_id)
          .eq("competitor_product_id", match.competitor_product_id)
      );
      
      const deleteResults = await Promise.all(deletePromises);
      const deleteErrors = deleteResults.filter((r) => r.error);
      
      if (deleteErrors.length > 0) {
        console.error("Error deleting some match candidates:", JSON.stringify(deleteErrors, null, 2));
        // Continue anyway - matches were already confirmed
      }
    }

    // Update competitor status to active
    await supabase
      .from("competitors")
      .update({ status: "active" })
      .eq("id", competitorId);

    return NextResponse.json({
      success: true,
      matches_confirmed: matchesToInsert.length,
    });
  } catch (err: any) {
    console.error("Error in POST /api/competitors/[competitorId]/matches/confirm:", JSON.stringify(err, null, 2));
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

