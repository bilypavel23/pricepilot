import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

// Import Shopify products (including inventory_quantity on first variant).
// This route does NOT expect any JSON body – it's triggered just by a POST
// from the UI ("Import products" button).
export async function POST() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // Get or create store for the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await getOrCreateStore();

  // For dev mode we prefer env token; if missing, fall back to store fields
  const shopDomain =
    process.env.SHOPIFY_TEST_SHOP_DOMAIN || store.shop_domain;
  const accessToken =
    process.env.SHOPIFY_TEST_ADMIN_TOKEN || store.shopify_access_token;

  if (!shopDomain || !accessToken) {
    return NextResponse.json(
      {
        error:
          "Missing Shopify credentials. Set SHOPIFY_TEST_SHOP_DOMAIN and SHOPIFY_TEST_ADMIN_TOKEN in .env.local or ensure store.shop_domain + store.shopify_access_token are filled.",
      },
      { status: 500 }
    );
  }

  const apiVersion = "2024-01";
  const url = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        {
          error: `Shopify API error: ${res.status} ${res.statusText}`,
          body,
          url,
        },
        { status: 400 }
      );
    }

    const data = await res.json();

    if (!data.products || !Array.isArray(data.products)) {
      return NextResponse.json(
        { error: "Unexpected Shopify response", body: data },
        { status: 400 }
      );
    }

    const productsToUpsert = data.products.map((p: any) => {
      const variant = p.variants?.[0];

      return {
        store_id: store.id,
        external_id: p.id.toString(),
        name: p.title,
        sku: variant?.sku ?? null,
        price: variant?.price ? parseFloat(variant.price) : null,
        cost: null,
        currency: "USD",
        status: "active",
        source: "shopify",
        inventory:
          typeof variant?.inventory_quantity === "number"
            ? variant.inventory_quantity
            : null,
      };
    });

    const { error: upsertError } = await supabase
      .from("products")
      .upsert(productsToUpsert, {
        onConflict: "external_id",
      });

    if (upsertError) {
      return NextResponse.json(
        {
          error: `Failed to upsert products: ${upsertError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: productsToUpsert.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch products from Shopify",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
