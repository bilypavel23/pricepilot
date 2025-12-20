import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    // Query URL competitors directly from competitor_url_products table
    // Step 1: Load all URL competitors for this store
    const { data: urlCompetitors, error: urlCompetitorsError } = await supabaseAdmin
      .from("competitor_url_products")
      .select("id, store_id, product_id, competitor_url, competitor_name, last_price, currency, last_checked_at")
      .eq("store_id", store.id);

    if (urlCompetitorsError) {
      console.error("[added-by-url-matches] Error loading URL competitors:", urlCompetitorsError);
      return NextResponse.json(
        { error: "Failed to load URL competitors", code: "SERVER_ERROR", details: urlCompetitorsError.message },
        { status: 500 }
      );
    }

    if (!urlCompetitors || urlCompetitors.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Step 2: Get product IDs and fetch products
    const productIds = [...new Set(urlCompetitors.map((uc: any) => uc.product_id).filter((id: any) => id))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, store_id")
      .in("id", productIds)
      .eq("store_id", store.id);

    if (productsError) {
      console.error("[added-by-url-matches] Error loading products:", productsError);
      return NextResponse.json(
        { error: "Failed to load products", code: "SERVER_ERROR", details: productsError.message },
        { status: 500 }
      );
    }

    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    // Step 3: Transform to response format
    // Map competitor_name to name for frontend compatibility
    const formattedMatches = urlCompetitors
      .map((urlComp: any) => {
        const product = productMap.get(urlComp.product_id);
        
        if (!product) {
          return null; // Skip if product not found
        }

        // Extract domain from URL for competitorDomain
        let competitorDomain = "Unknown";
        try {
          const urlObj = new URL(urlComp.competitor_url);
          const hostname = urlObj.hostname.replace(/^www\./, "");
          competitorDomain = hostname.split(".").slice(0, -1).join(".") || hostname;
        } catch {
          // Use competitor_name if URL parsing fails
          competitorDomain = urlComp.competitor_name || "Unknown";
        }

        return {
          matchId: urlComp.id, // Use competitor_url_products.id as matchId
          productId: product.id,
          productName: product.name || "Unnamed product",
          productSku: product.sku || null,
          competitorProductId: urlComp.id, // Use same ID for compatibility
          competitorUrl: urlComp.competitor_url,
          competitorName: urlComp.competitor_name || "Unnamed product", // Map competitor_name to name
          competitorDomain: competitorDomain,
          competitorPrice: urlComp.last_price || null,
        };
      })
      .filter((m: any) => m !== null) // Remove null entries
      .sort((a: any, b: any) => {
        // Sort by productName asc, then domain asc
        const nameCompare = (a.productName || "").localeCompare(b.productName || "");
        if (nameCompare !== 0) return nameCompare;
        return (a.competitorDomain || "").localeCompare(b.competitorDomain || "");
      });

    return NextResponse.json({ matches: formattedMatches });
  } catch (err: any) {
    console.error("[added-by-url-matches] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

