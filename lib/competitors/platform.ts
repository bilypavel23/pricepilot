export type CompetitorPlatform = "SHOPIFY" | "OTHER";

export function detectPlatformFromUrl(url: string): CompetitorPlatform {
  try {
    const u = new URL(url);
    // hodně Shopify shopů jede na myshopify.com
    if (u.hostname.endsWith("myshopify.com")) return "SHOPIFY";
    // často se používá /collections/ nebo /products/
    if (u.pathname.includes("/collections") || u.pathname.includes("/products")) {
      return "SHOPIFY";
    }
    return "OTHER";
  } catch {
    return "OTHER";
  }
}

