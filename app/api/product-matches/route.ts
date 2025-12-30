import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { getOrCreateStore } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();

    const body = await req.json();
    const { productId, competitorProductId } = body;

    if (!productId || !competitorProductId) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }

    // Get or create store (automatically creates one if none exists)
    const store = await getOrCreateStore();

    // Try to read names for score ~50 (manual)
    const { data: myProduct } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();

    const { data: compProduct } = await supabase
      .from("competitor_products")
      .select("name")
      .eq("id", competitorProductId)
      .single();

    const score = 50; // manual match

    const { error } = await supabase.from("product_matches").insert({
      store_id: store.id,
      product_id: productId,
      competitor_product_id: competitorProductId,
      match_score: score,
      status: "confirmed",
    });

    if (error) {
      console.error("Error inserting match:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in POST /api/product-matches:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

