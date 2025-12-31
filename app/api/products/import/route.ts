import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";
import { enforceProductLimit } from "@/lib/enforcement/productLimits";
import { checkCanWrite } from "@/lib/api-entitlements-check";
import { getEntitlements } from "@/lib/billing/entitlements";

export async function POST(req: Request) {
  try {
    // Check authentication and demo mode
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can write
    const writeCheck = await checkCanWrite(user.id);
    if (writeCheck) {
      return writeCheck;
    }

    // Get user profile for entitlements
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const entitlements = getEntitlements(profile, user.created_at);
    const effectivePlan = entitlements.effectivePlan;

    // Get or create store
    const store = await getOrCreateStore();

    const body = await req.json();
    const products = body.products;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "No products provided" },
        { status: 400 }
      );
    }

    // Validate required fields and prepare for insert
    const validProducts = products
      .map((p: any) => ({
        name: p.name?.trim() || null,
        sku: p.sku?.trim() || null,
        price: p.price != null && !isNaN(Number(p.price)) ? Number(p.price) : null,
        cost: p.cost != null && !isNaN(Number(p.cost)) ? Number(p.cost) : null,
        inventory: p.inventory != null && !isNaN(Number(p.inventory)) ? Number(p.inventory) : null,
        store_id: store.id,
        is_demo: false,
        source: "csv",
      }))
      .filter((p: any) => p.name && p.sku && p.price !== null);

    if (validProducts.length === 0) {
      return NextResponse.json(
        { error: "No valid products to import (missing required fields)" },
        { status: 400 }
      );
    }

    // Enforce product limit - partial imports allowed - use effective_plan for limits
    const limitEnforcement = await enforceProductLimit(store.id, effectivePlan, validProducts.length);

    if (limitEnforcement.allowedCount === 0) {
      return NextResponse.json(
        { 
          error: limitEnforcement.message,
          currentCount: limitEnforcement.currentCount,
          limit: limitEnforcement.limit,
        },
        { status: 403 }
      );
    }

    // Take only the allowed number of products
    const productsToInsert = validProducts.slice(0, limitEnforcement.allowedCount);

    // Insert into Supabase
    const { error } = await supabase
      .from("products")
      .insert(productsToInsert);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Database insert failed", details: error.message },
        { status: 500 }
      );
    }

    // Determine source from products (CSV or Feed URL)
    // Check the source field from the first product
    const source = productsToInsert[0]?.source === "feed_url" ? "Feed URL" : "CSV";

    // Mark products sync as completed
    const { error: syncError } = await supabase.rpc("mark_products_sync", {
      p_store_id: store.id,
      p_source: source,
    });

    if (syncError) {
      console.error("[products-import] Error calling mark_products_sync:", syncError);
      // Don't fail the import if sync marking fails
    }

    const response: any = { 
      success: true, 
      imported: productsToInsert.length,
    };

    // Add warning if import was truncated
    if (limitEnforcement.truncated) {
      response.warning = limitEnforcement.message;
      response.truncated = true;
      response.requested = validProducts.length;
      response.limit = limitEnforcement.limit;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Import failed", details: String(err) },
      { status: 500 }
    );
  }
}
