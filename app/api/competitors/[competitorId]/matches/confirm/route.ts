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

    // Verify all competitor products belong to this competitor
    const competitorProductIds = matches.map((m) => m.competitor_product_id);
    const { data: competitorProducts, error: competitorProductsError } = await supabase
      .from("competitor_products")
      .select("id, competitor_id, url, price, currency")
      .in("id", competitorProductIds)
      .eq("competitor_id", competitorId);

    if (competitorProductsError || !competitorProducts || competitorProducts.length !== matches.length) {
      return NextResponse.json(
        { error: "Invalid competitor product IDs" },
        { status: 400 }
      );
    }

    // Create competitor_product_matches records
    const matchesToInsert = matches.map((match) => ({
      competitor_id: competitorId,
      product_id: match.product_id,
      competitor_product_id: match.competitor_product_id,
    }));

    // Insert competitor_product_matches (upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from("competitor_product_matches")
      .upsert(matchesToInsert, {
        onConflict: "competitor_id,product_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Error inserting competitor_product_matches:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to save matches" },
        { status: 500 }
      );
    }

    // Update competitor products with latest price info and hash
    const { computePriceHash } = await import("@/lib/competitors/price-hash");
    for (const competitorProduct of competitorProducts) {
      const priceHash = computePriceHash(
        competitorProduct.price,
        competitorProduct.currency || "USD"
      );

      await supabase
        .from("competitor_products")
        .update({
          last_price_hash: priceHash,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", competitorProduct.id);
    }

    // Remove confirmed candidates from competitor_match_candidates
    const confirmedCandidateIds = matches.map((m) => {
      // Find the candidate ID that matches this confirmation
      // We need to query candidates to get their IDs
      return null; // Will be handled below
    });

    // Delete match candidates for confirmed matches
    const competitorProductIdsToRemove = matches.map((m) => m.competitor_product_id);
    if (competitorProductIdsToRemove.length > 0) {
      await supabase
        .from("competitor_match_candidates")
        .delete()
        .eq("competitor_id", competitorId)
        .in("competitor_product_id", competitorProductIdsToRemove);
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

