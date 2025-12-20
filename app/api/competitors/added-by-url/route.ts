import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_ERROR" },
        { status: 401 }
      );
    }

    // Get or create store
    const store = await getOrCreateStore();

    // Verify store belongs to user
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Store does not belong to user", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Query URL-added competitors (is_tracked = false)
    const { data: urlCompetitors, error: competitorsError } = await supabase
      .from("competitors")
      .select("id, name, url, domain, created_at")
      .eq("store_id", store.id)
      .eq("is_tracked", false)
      .order("created_at", { ascending: false });

    if (competitorsError) {
      console.error("[added-by-url] Error loading competitors:", competitorsError);
      return NextResponse.json(
        { error: "Failed to load competitors", code: "SERVER_ERROR" },
        { status: 500 }
      );
    }

    if (!urlCompetitors || urlCompetitors.length === 0) {
      return NextResponse.json({ domains: [] });
    }

    // For each competitor (domain group), load competitor_products and linked counts
    const domainsWithProducts = await Promise.all(
      urlCompetitors.map(async (competitor) => {
        // Get competitor products for this domain
        const { data: competitorProducts, error: cpError } = await supabase
          .from("competitor_products")
          .select("id, title, url, price, last_seen_at")
          .eq("competitor_id", competitor.id)
          .order("last_seen_at", { ascending: false });

        if (cpError) {
          console.error("[added-by-url] Error loading competitor products:", cpError);
        }

        const cpIds = (competitorProducts || []).map((cp) => cp.id);

        // Get linked products count for each competitor product (using confirmed matches only)
        const productsWithLinkedCount = await Promise.all(
          (competitorProducts || []).map(async (cp) => {
            const { count: linkedCount } = await supabase
              .from("competitor_product_matches")
              .select("*", { count: "exact", head: true })
              .eq("competitor_product_id", cp.id);

            return {
              id: cp.id,
              name: cp.title ?? "", // Use 'title' column
              url: cp.url,
              price: cp.price,
              updatedAt: cp.last_seen_at,
              linkedProductsCount: linkedCount || 0,
            };
          })
        );

        return {
          domain: competitor.domain || competitor.name,
          competitorId: competitor.id,
          url: competitor.url,
          products: productsWithLinkedCount,
          totalProducts: productsWithLinkedCount.length,
          totalLinked: productsWithLinkedCount.reduce((sum, p) => sum + p.linkedProductsCount, 0),
        };
      })
    );

    return NextResponse.json({ domains: domainsWithProducts });
  } catch (err: any) {
    console.error("[added-by-url] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}


