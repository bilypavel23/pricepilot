export type ShopifyScrapedProduct = {
  external_id?: string | null;
  name: string;
  price: number | null;
  url: string;
  raw?: any;
};

function normalizeStoreBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

/**
 * Pokusí se stáhnout produkty z Shopify přes /products.json.
 * Vrátí jen name, price, url (+ optional external_id, raw).
 */
export async function scrapeShopifyStore(
  storeUrl: string
): Promise<ShopifyScrapedProduct[]> {
  const base = normalizeStoreBaseUrl(storeUrl);
  try {
    const res = await fetch(`${base}/products.json?limit=250`, {
      method: "GET",
      // žádný API key – pokud to nemají zamčené
    });
    if (!res.ok) {
      console.warn("scrapeShopifyStore: non-OK status", res.status);
      return [];
    }
    const json: any = await res.json();
    if (!json.products || !Array.isArray(json.products)) {
      return [];
    }
    const products: ShopifyScrapedProduct[] = json.products.map((p: any) => {
      const defaultVariant = Array.isArray(p.variants) ? p.variants[0] : null;
      const price =
        defaultVariant && defaultVariant.price
          ? Number(defaultVariant.price)
          : null;
      return {
        external_id: p.id ? String(p.id) : null,
        name: p.title ?? "Unknown product",
        price,
        url: `${base}/products/${p.handle}`,
        raw: p,
      };
    });
    return products;
  } catch (error) {
    console.error("scrapeShopifyStore error:", error);
    return [];
  }
}


