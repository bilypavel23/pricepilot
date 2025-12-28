import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getOrCreateStore } from "@/lib/store";
import { createActivityEvent } from "@/lib/activity-events/createActivityEvent";
import { enforceProductLimit } from "@/lib/enforcement/productLimits";

export async function POST() {
  // Require authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult; // 401 response
  }
  const { supabase, user } = authResult;

  // Get user plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan;

  const store = await getOrCreateStore();

  // Dev mode: prefer fixed token/domain from env, fall back to store fields
  const shopDomain =
    process.env.SHOPIFY_TEST_SHOP_DOMAIN || store.shop_domain;
  const accessToken =
    process.env.SHOPIFY_TEST_ADMIN_TOKEN || store.shopify_access_token;

  if (!shopDomain || !accessToken) {
    return NextResponse.json(
      {
        error:
          "Missing Shopify credentials. Set SHOPIFY_TEST_SHOP_DOMAIN and SHOPIFY_TEST_ADMIN_TOKEN in .env.local OR fill store.shop_domain + store.shopify_access_token.",
      },
      { status: 500 }
    );
  }

  const apiVersion = "2024-01";
  const productsUrl = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250`;

  try {
    // 1) Fetch products (price, inventory_quantity, inventory_item_id at variant level)
    const productsRes = await fetch(productsUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!productsRes.ok) {
      const body = await productsRes.text();
      return NextResponse.json(
        {
          error: `Shopify products API error: ${productsRes.status} ${productsRes.statusText}`,
          body,
          url: productsUrl,
        },
        { status: 400 }
      );
    }

    const productsData = await productsRes.json();

    if (!productsData.products || !Array.isArray(productsData.products)) {
      return NextResponse.json(
        { error: "Unexpected Shopify products response", body: productsData },
        { status: 400 }
      );
    }

    // 2) Collect all inventory_item_id from variants
    const inventoryItemIdSet = new Set<number>();

    for (const p of productsData.products) {
      const variants = p.variants || [];
      for (const v of variants) {
        if (v.inventory_item_id) {
          inventoryItemIdSet.add(v.inventory_item_id);
        }
      }
    }

    // 3) Fetch inventory_items with cost (if any IDs)
    const inventoryCostMap = new Map<number, number>();

    if (inventoryItemIdSet.size > 0) {
      const idsParam = Array.from(inventoryItemIdSet).join(",");
      const inventoryUrl = `https://${shopDomain}/admin/api/${apiVersion}/inventory_items.json?ids=${idsParam}`;

      const invRes = await fetch(inventoryUrl, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (invRes.ok) {
        const invData = await invRes.json();

        if (Array.isArray(invData.inventory_items)) {
          for (const item of invData.inventory_items) {
            if (
              item.id &&
              item.cost !== undefined &&
              item.cost !== null &&
              item.cost !== ""
            ) {
              const idNum = Number(item.id);
              const costNum = Number(item.cost);
              if (!Number.isNaN(idNum) && !Number.isNaN(costNum)) {
                inventoryCostMap.set(idNum, costNum);
              }
            }
          }
        }
      } else {
        // If inventory call fails (e.g. missing read_inventory scope), we still continue without cost
        const body = await invRes.text();
        console.warn("Shopify inventory_items error:", invRes.status, body);
      }
    }

    // 4) Transform products for upsert into DB (price + inventory + cost)
    const allProducts = productsData.products.map((p: any) => {
      const variant = p.variants?.[0];

      const price =
        variant?.price !== undefined && variant?.price !== null
          ? parseFloat(variant.price)
          : null;

      const inventory =
        typeof variant?.inventory_quantity === "number"
          ? variant.inventory_quantity
          : null;

      const inventoryItemId =
        typeof variant?.inventory_item_id === "number"
          ? variant.inventory_item_id
          : null;

      let cost: number | null = null;
      if (inventoryItemId && inventoryCostMap.has(inventoryItemId)) {
        cost = inventoryCostMap.get(inventoryItemId)!;
      }

      return {
        store_id: store.id,
        external_id: p.id.toString(),
        name: p.title,
        sku: variant?.sku ?? null,
        price,
        cost,
        currency: "USD",
        status: "active",
        source: "shopify",
        inventory,
      };
    });

    // 5) Enforce product limit - partial imports allowed
    const limitEnforcement = await enforceProductLimit(store.id, plan, allProducts.length);

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
    const productsToUpsert = allProducts.slice(0, limitEnforcement.allowedCount);

    // 6) Upsert by (store_id, external_id)
    const { error: upsertError } = await supabase
      .from("products")
      .upsert(productsToUpsert, {
        onConflict: "store_id,external_id",
      });

    if (upsertError) {
      return NextResponse.json(
        {
          error: `Failed to upsert products: ${upsertError.message}`,
        },
        { status: 500 }
      );
    }

    // Log activity event
    await createActivityEvent(
      store.id,
      "products_sync",
      `Product sync completed: ${productsToUpsert.length} products`,
      {
        count: productsToUpsert.length,
        truncated: limitEnforcement.truncated,
      }
    );

    // Mark products sync as completed
    const { error: syncError } = await supabase.rpc("mark_products_sync", {
      p_store_id: store.id,
      p_source: "Shopify",
    });

    if (syncError) {
      console.error("[shopify-import] Error calling mark_products_sync:", syncError);
      // Don't fail the import if sync marking fails
    }

    const response: any = {
      success: true,
      imported: productsToUpsert.length,
      withCost: Array.from(inventoryCostMap.keys()).length,
    };

    // Add warning if import was truncated
    if (limitEnforcement.truncated) {
      response.warning = limitEnforcement.message;
      response.truncated = true;
      response.requested = allProducts.length;
      response.limit = limitEnforcement.limit;
    }

    return NextResponse.json(response);
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
