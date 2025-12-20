import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";

/**
 * POST /api/competitors/confirm-matches
 * 
 * Confirms matches between my products and competitor products
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { competitor_store_id, matches } = body as {
      competitor_store_id: string;
      matches: Array<{ product_id: string; competitor_product_id: string }>;
    };

    if (!competitor_store_id || !matches || !Array.isArray(matches)) {
      return NextResponse.json(
        { error: "Missing competitor_store_id or matches" },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore();

    // Verify competitor store belongs to user's store
    const { data: competitorStore, error: competitorError } = await supabase
      .from("competitors")
      .select("id, store_id")
      .eq("id", competitor_store_id)
      .eq("store_id", store.id)
      .single();

    if (competitorError || !competitorStore) {
      return NextResponse.json(
        { error: "Competitor store not found" },
        { status: 404 }
      );
    }

    // Verify all competitor products belong to this competitor store
    const competitorProductIds = matches.map((m) => m.competitor_product_id);
    const { data: competitorProducts, error: productsError } = await supabase
      .from("competitor_products")
      .select("id, competitor_store_id, url, price, currency")
      .in("id", competitorProductIds)
      .eq("competitor_store_id", competitor_store_id);

    if (productsError || !competitorProducts) {
      return NextResponse.json(
        { error: "Failed to verify competitor products" },
        { status: 500 }
      );
    }

    // Verify all my products belong to user's store
    const myProductIds = matches.map((m) => m.product_id);
    const { data: myProducts, error: myProductsError } = await supabase
      .from("products")
      .select("id, store_id")
      .in("id", myProductIds)
      .eq("store_id", store.id)
      .eq("is_demo", false);

    if (myProductsError || !myProducts || myProducts.length !== matches.length) {
      return NextResponse.json(
        { error: "Failed to verify my products" },
        { status: 500 }
      );
    }

    // Create product matches
    // Note: Use competitor_id (not competitor_store_id) and product_id (not my_product_id)
    const matchesToInsert = matches.map((match) => {
      const competitorProduct = competitorProducts.find(
        (cp) => cp.id === match.competitor_product_id
      );
      return {
        competitor_id: competitor_store_id, // competitor_store_id is actually competitor_id
        product_id: match.product_id,
        competitor_product_id: match.competitor_product_id,
      };
    });

    const { error: insertError } = await supabase
      .from("competitor_product_matches")
      .upsert(matchesToInsert, {
        onConflict: "competitor_id,product_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Error inserting product matches:", insertError);
      return NextResponse.json(
        { error: "Failed to save matches" },
        { status: 500 }
      );
    }

    // Update competitor products with latest price info
    for (const match of matches) {
      const competitorProduct = competitorProducts.find(
        (cp) => cp.id === match.competitor_product_id
      );
      if (competitorProduct) {
        // Compute price hash
        const priceHash = computePriceHash(
          competitorProduct.price,
          competitorProduct.currency || "USD"
        );

        await supabase
          .from("competitor_products")
          .update({
            last_price: competitorProduct.price,
            last_price_hash: priceHash,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", competitorProduct.id);
      }
    }

    return NextResponse.json({
      success: true,
      matches_confirmed: matchesToInsert.length,
    });
  } catch (err: any) {
    console.error("Error in POST /api/competitors/confirm-matches:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * Compute price hash for change detection
 */
function computePriceHash(price: number | null, currency: string): string {
  const data = `${price || 0}|${currency}`;
  // Simple hash (in production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

