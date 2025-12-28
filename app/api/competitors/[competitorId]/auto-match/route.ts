import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
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
      .select("id, title")
      .eq("competitor_id", competitorId);

    if (!myProducts || !competitorProducts || myProducts.length === 0 || competitorProducts.length === 0) {
      return NextResponse.json({ success: true, created: 0 });
    }

    const candidatesToInsert: any[] = [];

    for (const p of myProducts) {
      const pName = (p.name ?? "").toLowerCase();

      // Find competitor product with highest similarity by title (simple includes)
      let best: { cp: any; score: number } | null = null;

      for (const cp of competitorProducts) {
        const cpTitle = (cp.title ?? "").toLowerCase();
        let score = 0;

        if (pName === cpTitle) score = 100;
        else if (pName.includes(cpTitle) || cpTitle.includes(pName)) score = 85;
        else if (pName.split(" ").some((word: string) => word.length > 3 && cpTitle.includes(word)))
          score = 70;

        if (!best || score > best.score) {
          best = { cp, score };
        }
      }

      if (best && best.score >= 70) {
        candidatesToInsert.push({
          competitor_id: competitorId,
          my_product_id: p.id,
          competitor_product_id: best.cp.id,
          score: best.score,
        });
      }
    }

    if (candidatesToInsert.length > 0) {
      const { error } = await supabase
        .from("competitor_match_candidates")
        .upsert(candidatesToInsert, {
          onConflict: "competitor_id,my_product_id,competitor_product_id",
          ignoreDuplicates: false,
        });
      if (error) {
        console.error("Error inserting match candidates:", JSON.stringify(error, null, 2));
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, created: candidatesToInsert.length });
  } catch (err: any) {
    console.error("Error in POST /api/competitors/[competitorId]/auto-match:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

