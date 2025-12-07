import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Create a service role client for webhooks (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const product = body;

    // Handle product create/update
    if (product && product.id) {
      const variant = product.variants?.[0] || {};
      const shopDomain = req.headers.get("x-shopify-shop-domain");

      if (!shopDomain) {
        return NextResponse.json(
          { error: "Missing shop domain" },
          { status: 400 }
        );
      }

      // Find store by shop domain
      const { data: stores } = await supabase
        .from("stores")
        .select("id")
        .eq("shop_domain", shopDomain)
        .eq("platform", "shopify")
        .limit(1);

      if (!stores || stores.length === 0) {
        return NextResponse.json(
          { error: "Store not found" },
          { status: 404 }
        );
      }

      const storeId = stores[0].id;

      // Upsert product
      const { error } = await supabase
        .from("products")
        .upsert(
          {
            store_id: storeId,
            external_id: product.id.toString(),
            name: product.title,
            sku: variant.sku || null,
            price: parseFloat(variant.price || 0),
            inventory: variant.inventory_quantity || 0,
            status: product.status === "active" ? "active" : "inactive",
            source: "shopify",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "external_id,store_id",
          }
        );

      if (error) {
        console.error("Webhook error:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}


