import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

export async function POST(
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

    // Get or create store (automatically creates one if none exists)
    const store = await getOrCreateStore();

    // Get my products
    const { data: myProducts } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", store.id)
      .eq("is_demo", false);

    // Get competitor products
    const { data: competitorProducts } = await supabase
      .from("competitor_products")
      .select("id, name")
      .eq("competitor_id", competitorId);

    if (!myProducts || !competitorProducts) {
      return NextResponse.json({ success: true, created: 0 });
    }

    const matchesToInsert: any[] = [];

    for (const p of myProducts) {
      const pName = p.name.toLowerCase();

      // Find competitor product with highest similarity by name (simple includes)
      let best: { cp: any; score: number } | null = null;

      for (const cp of competitorProducts) {
        const cpName = cp.name.toLowerCase();
        let score = 0;

        if (pName === cpName) score = 100;
        else if (pName.includes(cpName) || cpName.includes(pName)) score = 85;
        else if (pName.split(" ").some((word: string) => word.length > 3 && cpName.includes(word)))
          score = 70;

        if (!best || score > best.score) {
          best = { cp, score };
        }
      }

      if (best && best.score >= 70) {
        matchesToInsert.push({
          store_id: store.id,
          product_id: p.id,
          competitor_product_id: best.cp.id,
          match_score: best.score,
          status: "pending",
        });
      }
    }

    if (matchesToInsert.length > 0) {
      const { error } = await supabase.from("product_matches").insert(matchesToInsert);
      if (error) {
        console.error("Error inserting matches:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, created: matchesToInsert.length });
  } catch (err: any) {
    console.error("Error in POST /api/competitors/[competitorId]/auto-match:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

