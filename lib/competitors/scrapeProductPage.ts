import * as cheerio from "cheerio";

export interface ScrapedProductPage {
  name: string;
  price: number | null;
  currency?: string;
}

// Bot/captcha detection markers (case-insensitive)
const BOT_BLOCK_MARKERS = [
  "captcha",
  "access denied",
  "blocked",
  "verify you are human",
  "please verify",
  "are you a robot",
  "cloudflare",
  "just a moment",
  "checking your browser",
];

/**
 * Check if HTML contains bot/captcha block markers
 */
function detectBotBlock(html: string): boolean {
  const lower = html.toLowerCase();
  return BOT_BLOCK_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Fetch HTML using ScrapingBee API with fallback options
 */
async function fetchHtmlWithScrapingBee(
  url: string,
  attempt: number,
  options?: {
    renderJs?: boolean;
    premiumProxy?: boolean;
  }
): Promise<string> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPINGBEE_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    render_js: options?.renderJs ? "true" : "false",
    premium_proxy: options?.premiumProxy ? "true" : "false",
  });

  console.log(`[scrapeProductPage] Attempt ${attempt} - renderJs=${options?.renderJs}, premiumProxy=${options?.premiumProxy}`);

  const response = await fetch(
    `https://app.scrapingbee.com/api/v1/?${params.toString()}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }
  );

  if (!response.ok) {
    console.error(`[scrapeProductPage] Attempt ${attempt} failed - status ${response.status}`);
    throw new Error(`ScrapingBee failed: ${response.status}`);
  }

  console.log(`[scrapeProductPage] Attempt ${attempt} succeeded - status ${response.status}`);
  return await response.text();
}

/**
 * Scrape a single product page to extract name and price.
 * Uses ScrapingBee with fallback strategy:
 * 1. No JS, no premium proxy (cheapest)
 * 2. Premium proxy, no JS
 * 3. JS render + premium proxy (last resort)
 */
export async function scrapeProductPage(
  productUrl: string
): Promise<ScrapedProductPage> {
  let html: string;
  let successAttempt = 0;

  try {
    // 🟢 Attempt 1 – cheapest (no JS, no premium proxy)
    html = await fetchHtmlWithScrapingBee(productUrl, 1, {
      renderJs: false,
      premiumProxy: false,
    });
    successAttempt = 1;
  } catch (err1) {
    try {
      console.warn("[scrapeProductPage] Attempt 1 failed, trying premium proxy", err1);

      // 🟡 Attempt 2 – premium proxy (still no JS)
      html = await fetchHtmlWithScrapingBee(productUrl, 2, {
        renderJs: false,
        premiumProxy: true,
      });
      successAttempt = 2;
    } catch (err2) {
      try {
        console.warn("[scrapeProductPage] Attempt 2 failed, trying JS render", err2);

        // 🔴 Attempt 3 – JS render (last resort)
        html = await fetchHtmlWithScrapingBee(productUrl, 3, {
          renderJs: true,
          premiumProxy: true,
        });
        successAttempt = 3;
      } catch (err3) {
        console.error("[scrapeProductPage] All attempts failed", err3);
        throw new Error("BOT_BLOCKED");
      }
    }
  }

  console.log(`[scrapeProductPage] html length ${html.length}, url ${productUrl}, attempt ${successAttempt}`);

  // Check for bot/captcha blocks
  if (detectBotBlock(html)) {
    console.error("[scrapeProductPage] Bot/captcha block detected in HTML");
    throw new Error("BOT_BLOCKED");
  }

  const $ = cheerio.load(html);

  // Initialize result with defaults
  let name = "Product";
  let price: number | null = null;
  let currency = "USD";

  // ========== STRATEGY 1: Try Shopify .js endpoint (if applicable) ==========
  const shopifyData = await tryShopifyProductJs(productUrl);
  if (shopifyData) {
    if (shopifyData.name) name = shopifyData.name;
    if (shopifyData.price !== undefined) price = shopifyData.price;
    if (shopifyData.currency) currency = shopifyData.currency;
    
    // If we got price from Shopify, we can return early (but still check LD+JSON for better name/currency)
    if (price !== null) {
      console.log(`[scrapeProductPage] Got price from Shopify .js, continuing to extract name/currency from HTML`);
    }
  }

  // ========== STRATEGY 2: Extract from LD+JSON (preferred, cheap) ==========
  const ldJsonData = extractFromLdJson($);
  if (ldJsonData.name && name === "Product") {
    name = ldJsonData.name;
  }
  if (ldJsonData.price !== undefined && price === null) {
    price = ldJsonData.price;
  }
  if (ldJsonData.currency) {
    currency = ldJsonData.currency;
  }

  // ========== STRATEGY 3: Fallback to Cheerio DOM selectors ==========
  
  // Extract name (only if not already found)
  if (name === "Product") {
    const nameSelectors = [
      'h1[class*="product"]',
      'h1[class*="title"]',
      ".product-title",
      ".product-name",
      "h1",
      '[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[property="og:title"]',
    ];

    for (const selector of nameSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const text = el.text().trim() || el.attr("content");
        if (text) {
          name = text;
          break;
        }
      }
    }
  }

  // Extract price (only if not already found)
  if (price === null) {
    const priceSelectors = [
      '[itemprop="price"]',
      '[data-price]',
      '[data-product-price]',
      '[class*="price"]',
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
    ];

    for (const selector of priceSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const raw =
          el.text().trim() ||
          el.attr("content") ||
          el.attr("data-price");
        const parsed = parsePrice(raw || "");
        if (parsed !== null) {
          price = parsed;
          break;
        }
      }
    }
  }

  // Extract currency (only if not already found)
  if (currency === "USD") {
    const currencySelectors = [
      '[itemprop="priceCurrency"]',
      'meta[property="product:price:currency"]',
      'meta[property="og:price:currency"]',
    ];

    for (const selector of currencySelectors) {
      const el = $(selector).first();
      if (el.length) {
        const c = el.attr("content") || el.text().trim();
        if (c) {
          currency = c.toUpperCase();
          break;
        }
      }
    }
  }

  console.log(`[scrapeProductPage] Final parsed - name: "${name}", price: ${price}, currency: ${currency}`);

  return { name, price, currency };
}

/**
 * Extract price number from text like "$19.99", "€ 12,50", "1 299 Kč"
 */
function parsePrice(str: string): number | null {
  if (!str) return null;
  // Handle both string and number inputs
  if (typeof str === "number") {
    return str > 0 ? str : null;
  }
  // Remove currency symbols and letters, keep digits, dots, commas
  const cleaned = str
    .replace(/[^\d.,-]+/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) return null;

  // Handle both comma and dot as decimal separators
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    // Use the one further right as decimal separator
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

/**
 * Extract price, currency, and name from LD+JSON structured data
 */
function extractFromLdJson($: ReturnType<typeof cheerio.load>): {
  price?: number;
  currency?: string;
  name?: string;
} {
  const result: { price?: number; currency?: string; name?: string } = {};

  try {
    const scripts = $('script[type="application/ld+json"]');
    
    scripts.each((_, el) => {
      try {
        const text = $(el).text().trim();
        if (!text) return;

        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          return; // Skip invalid JSON
        }

        // Handle arrays, @graph, or single objects
        let items: any[] = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data["@graph"] && Array.isArray(data["@graph"])) {
          items = data["@graph"];
        } else {
          items = [data];
        }

        for (const item of items) {
          // Check if this is a Product type
          const type = item["@type"];
          const types = Array.isArray(type) ? type : type ? [type] : [];
          const isProduct = types.some((t: string) => 
            typeof t === "string" && t.toLowerCase().includes("product")
          );

          if (!isProduct) continue;

          // Extract name
          if (!result.name && item.name) {
            result.name = typeof item.name === "string" ? item.name : String(item.name);
          }

          // Extract price from offers
          if (!result.price && item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            
            for (const offer of offers) {
              if (!offer) continue;

              // Try different price paths
              let priceValue: any = null;
              if (offer.price !== undefined) {
                priceValue = offer.price;
              } else if (offer.priceSpecification?.price !== undefined) {
                priceValue = offer.priceSpecification.price;
              }

              if (priceValue !== null && priceValue !== undefined) {
                const parsed = parsePrice(String(priceValue));
                if (parsed !== null) {
                  result.price = parsed;
                  break;
                }
              }

              // Extract currency
              if (!result.currency && offer.priceCurrency) {
                result.currency = String(offer.priceCurrency).toUpperCase();
              }
            }
          }

          // Also check for direct priceCurrency on Product
          if (!result.currency && item.priceCurrency) {
            result.currency = String(item.priceCurrency).toUpperCase();
          }
        }
      } catch (err) {
        // Skip this script if parsing fails
        console.warn("[extractFromLdJson] Error parsing script:", err);
      }
    });
  } catch (err) {
    console.warn("[extractFromLdJson] Error extracting LD+JSON:", err);
  }

  return result;
}

/**
 * Try to fetch product data from Shopify .js endpoint
 * Returns null if URL doesn't look like Shopify or fetch fails
 */
async function tryShopifyProductJs(
  productUrl: string
): Promise<{ name?: string; price?: number; currency?: string } | null> {
  try {
    const url = new URL(productUrl);
    const pathname = url.pathname;

    // Check if URL looks like Shopify product page
    const shopifyMatch = pathname.match(/^\/products\/([^\/\?]+)/);
    if (!shopifyMatch) {
      return null; // Not a Shopify product URL
    }

    const handle = shopifyMatch[1];
    const shopifyJsUrl = `${url.origin}/products/${handle}.js`;

    console.log(`[tryShopifyProductJs] Attempting Shopify .js endpoint: ${shopifyJsUrl}`);

    // Try fetching with ScrapingBee (cheapest option first)
    let jsonText: string;
    try {
      jsonText = await fetchHtmlWithScrapingBee(shopifyJsUrl, 1, {
        renderJs: false,
        premiumProxy: false,
      });
    } catch (err1) {
      try {
        console.warn("[tryShopifyProductJs] Attempt 1 failed, trying premium proxy", err1);
        jsonText = await fetchHtmlWithScrapingBee(shopifyJsUrl, 2, {
          renderJs: false,
          premiumProxy: true,
        });
      } catch (err2) {
        console.warn("[tryShopifyProductJs] All attempts failed", err2);
        return null; // Fail silently, fall back to other methods
      }
    }

    // Parse JSON
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch (parseErr) {
      console.warn("[tryShopifyProductJs] Failed to parse JSON", parseErr);
      return null;
    }

    const result: { name?: string; price?: number; currency?: string } = {};

    // Extract name
    if (data.title) {
      result.name = String(data.title);
    }

    // Extract price from variants
    if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
      const firstVariant = data.variants[0];
      if (firstVariant.price !== undefined) {
        let priceValue = firstVariant.price;
        
        // Handle string prices
        if (typeof priceValue === "string") {
          const parsed = parsePrice(priceValue);
          if (parsed !== null) {
            result.price = parsed;
          }
        } else if (typeof priceValue === "number") {
          // Shopify often uses cents (integer > 1000 with no decimals)
          // Check if it looks like cents: integer and > 1000
          if (Number.isInteger(priceValue) && priceValue > 1000 && priceValue % 100 !== 0) {
            result.price = priceValue / 100;
          } else {
            result.price = priceValue;
          }
        }
      }
    }

    // Currency might not be in .js endpoint, will use default or from HTML
    if (data.currency) {
      result.currency = String(data.currency).toUpperCase();
    }

    if (result.name || result.price !== undefined) {
      console.log(`[tryShopifyProductJs] Success - name: "${result.name}", price: ${result.price}`);
      return result;
    }

    return null;
  } catch (err) {
    console.warn("[tryShopifyProductJs] Error:", err);
    return null;
  }
}
