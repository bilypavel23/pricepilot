import * as cheerio from "cheerio";

export interface ScrapedProductPage {
  name: string;
  price: number | null;
  currency?: string;
}

/**
 * Scrape a single product page to extract name and price.
 * This is a best-effort scraper that tries common selectors.
 */
export async function scrapeProductPage(
  productUrl: string
): Promise<ScrapedProductPage> {
  try {
    // Fetch the page
    const response = await fetch(productUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to extract product name
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
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim() || element.attr("content");
        if (text && text.length > 0) {
          name = text;
          break;
        }
      }
    }

    // Try to extract price
    const priceSelectors = [
      '[class*="price"]',
      '[class*="Price"]',
      '[data-price]',
      '[data-product-price]',
      '[itemprop="price"]',
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
    ];

    let price: number | null = null;
    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const priceText =
          element.text().trim() ||
          element.attr("content") ||
          element.attr("data-price");
        if (priceText) {
          const parsed = parsePrice(priceText);
          if (parsed !== null) {
            price = parsed;
            break;
          }
        }
      }
    }

    // Try to extract currency
    let currency = "USD";
    const currencySelectors = [
      '[itemprop="priceCurrency"]',
      'meta[property="product:price:currency"]',
      'meta[property="og:price:currency"]',
    ];

    for (const selector of currencySelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const currencyText =
          element.attr("content") || element.text().trim();
        if (currencyText) {
          currency = currencyText.toUpperCase();
          break;
        }
      }
    }

    return {
      name,
      price,
      currency,
    };
  } catch (error) {
    console.error("Error scraping product page:", error);
    throw new Error("Could not fetch product data from this URL");
  }
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


