import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { createActivityEvent } from "@/lib/activity-events/createActivityEvent";

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
    const { productId, newPrice, recommendedPrice } = body as {
      productId: string;
      newPrice?: number;
      recommendedPrice?: number; // Keep for backward compatibility
    };

    // Support both newPrice and recommendedPrice for backward compatibility
    const priceToUpdate = newPrice ?? recommendedPrice;

    if (!productId || typeof priceToUpdate !== "number") {
      return NextResponse.json(
        { error: "Missing productId or newPrice/recommendedPrice" },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore();

    // Check if store is Shopify and has access token
    if (
      store.platform !== "shopify" ||
      !store.shop_domain ||
      !store.shopify_access_token
    ) {
      return NextResponse.json(
        { error: "Store is not connected to Shopify" },
        { status: 400 }
      );
    }

    // Get product from database to find external_id and name
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, external_id, store_id, name, price")
      .eq("id", productId)
      .eq("store_id", store.id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (!product.external_id) {
      return NextResponse.json(
        { error: "Product does not have an external_id (not synced from Shopify)" },
        { status: 400 }
      );
    }

    // Update price in Shopify
    const apiVersion = "2024-01";
    // external_id is the Shopify product ID
    const shopifyProductId = product.external_id;

    // First, get the product to find the variant
    const getProductRes = await fetch(
      `https://${store.shop_domain}/admin/api/${apiVersion}/products/${shopifyProductId}.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": store.shopify_access_token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!getProductRes.ok) {
      const errorText = await getProductRes.text();
      return NextResponse.json(
        {
          error: `Failed to fetch product from Shopify: ${getProductRes.status}`,
          details: errorText,
        },
        { status: 400 }
      );
    }

    const shopifyProductData = await getProductRes.json();
    const shopifyProduct = shopifyProductData.product;

    if (!shopifyProduct || !shopifyProduct.variants || shopifyProduct.variants.length === 0) {
      return NextResponse.json(
        { error: "Product variant not found in Shopify" },
        { status: 404 }
      );
    }

    // Update the first variant's price (or you could match by SKU if needed)
    const variant = shopifyProduct.variants[0];
    variant.price = priceToUpdate.toString();

    // Update the product with the modified variant
    const updateRes = await fetch(
      `https://${store.shop_domain}/admin/api/${apiVersion}/products/${shopifyProductId}.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": store.shopify_access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: {
            id: shopifyProductId,
            variants: shopifyProduct.variants,
          },
        }),
      }
    );

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      return NextResponse.json(
        {
          error: `Failed to update price in Shopify: ${updateRes.status}`,
          details: errorText,
        },
        { status: 400 }
      );
    }

    // Update price in our database
    const { error: updateError } = await supabase
      .from("products")
      .update({
        price: priceToUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (updateError) {
      console.error("Failed to update product price in DB:", updateError);
      // Don't fail the request if DB update fails, Shopify update succeeded
    }

    // Log activity event
    if (product) {
      const oldPrice = product.price;
      await createActivityEvent(
        store.id,
        "price_updated",
        `Price updated for ${product.name || "Product"}`,
        {
          productId: product.id,
          oldPrice,
          newPrice: priceToUpdate,
        }
      );
    }

    return NextResponse.json(
      { success: true, message: "Price updated successfully" },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Update price error:", e);
    return NextResponse.json(
      { error: "Failed to update price", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

