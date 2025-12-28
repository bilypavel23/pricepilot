import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET(req: Request) {
  // Require authentication before initiating OAuth flow
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult; // 401 response
  }

  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop_domain");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop_domain" }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/shopify/callback`;

  const scopes = [
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
  ].join(",");

  const url =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(url);
}

