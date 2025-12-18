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

  // ---------- NAME ----------
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

  let name = "Product";
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

  // ---------- PRICE ----------
  const priceSelectors = [
    '[itemprop="price"]',
    '[data-price]',
    '[data-product-price]',
    '[class*="price"]',
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
  ];

  let price: number | null = null;
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

  // ---------- CURRENCY ----------
  let currency = "USD";
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

  console.log(`[scrapeProductPage] Parsed - name: "${name}", price: ${price}, currency: ${currency}`);

  return { name, price, currency };
}

/**
 * Extract price number from text like "$19.99", "€ 12,50", "1 299 Kč"
 */
function parsePrice(str: string): number | null {
  if (!str) return null;
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
