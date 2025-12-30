import { NextResponse } from "next/server";

function normalizeShopDomain(input: string): string {
  const raw = (input ?? "").trim();

  // Parse with URL if protocol exists, otherwise assume https://
  try {
    const u = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw)
      : new URL(`https://${raw}`);
    return u.hostname.toLowerCase();
  } catch {
    // fallback: strip protocol and path manually
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .trim();
  }
}

function isValidShopifyShop(host: string): boolean {
  // allow *.myshopify.com only
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(host);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawShopDomain = searchParams.get("shop_domain") ?? "";

  if (!rawShopDomain) {
    return NextResponse.json({ error: "Missing shop_domain" }, { status: 400 });
  }

  const shop = normalizeShopDomain(rawShopDomain);

  if (!isValidShopifyShop(shop)) {
    return NextResponse.json(
      { error: "Invalid Shopify shop domain. Use e.g. great-fruit-2.myshopify.com" },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID!;

  const baseUrlRaw = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrlRaw) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_APP_URL env var" },
      { status: 500 }
    );
  }
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const redirectUri = `${baseUrl}/api/integrations/shopify/callback`;

  const scopes = [
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
  ].join(",");

  // Build authorizeUrl using URL constructor
  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);

  const authorizeUrlString = authorizeUrl.toString();

  // Redact client_secret if present in URL
  const redactedUrl = authorizeUrlString.replace(/client_secret=[^&]*/gi, "client_secret=***REDACTED***");

  console.log("Shopify OAuth redirect:", {
    authorizeUrl: redactedUrl,
    shop_domain_raw: rawShopDomain,
    shop_domain_normalized: shop,
    redirect_uri: redirectUri,
  });

  console.log("Shopify redirect_uri used:", redirectUri);

  return NextResponse.redirect(authorizeUrlString, 307);
}

