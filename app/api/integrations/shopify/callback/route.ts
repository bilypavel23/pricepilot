import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

export async function GET(req: Request) {
  const cookieStore = await cookies();
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

  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");

  if (!shop || !code) {
    return NextResponse.json({ error: "Missing shop or code" }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Shopify credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // Exchange code for access token
    const tokenReq = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenReq.ok) {
      const errorText = await tokenReq.text();
      console.error("Shopify OAuth error:", errorText);
      return NextResponse.json(
        { error: "Failed to exchange code for token" },
        { status: 400 }
      );
    }

    const tokenJson = await tokenReq.json();

    if (!tokenJson.access_token) {
      return NextResponse.json(
        { error: "OAuth failed: No access token received" },
        { status: 400 }
      );
    }

    // Get or create store
    const store = await getOrCreateStore();

    // Update store with Shopify credentials
    const { error } = await supabase
      .from("stores")
      .update({
        platform: "shopify",
        shop_domain: shop,
        shopify_access_token: tokenJson.access_token,
      })
      .eq("id", store.id);

    if (error) {
      console.error("Error updating store:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Redirect to dashboard
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/app/dashboard`);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "Unexpected error during OAuth" },
      { status: 500 }
    );
  }
}




