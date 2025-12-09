import { detectPlatformFromUrl } from "./platform";
import { scrapeShopifyStore } from "./shopify";
import * as cheerio from "cheerio";

export type RawScrapedProduct = {
  external_id?: string | null;
  name: string;
  price: number | null;
  url: string;
  raw?: any;
};

const MAX_PAGES = 20;           // bezpečný strop na počet listing stránek
const MIN_PRODUCTS_TO_CONTINUE = 3; // když na stránce skoro nic není, přestaneme

export async function scrapeCompetitorProducts(
  competitorUrl: string
): Promise<RawScrapedProduct[]> {
  const platform = detectPlatformFromUrl(competitorUrl);
  // 1) Shopify pokus – levné / zdarma
  if (platform === "SHOPIFY") {
    const shopifyProducts = await scrapeShopifyStore(competitorUrl);
    if (shopifyProducts.length > 0) {
      return shopifyProducts;
    }
    // pokud nic, spadneme do generic scraperu
  }
  // 2) Generic HTML scraper přes scraping API
  const generic = await scrapeViaApiListing(competitorUrl);
  return generic;
}

// -----------------------
// Generic listing scraper
// -----------------------
async function scrapeViaApiListing(
  storeUrl: string
): Promise<RawScrapedProduct[]> {
  const apiKey = process.env.SCRAPING_API_KEY;
  const apiBase = process.env.SCRAPING_API_BASE_URL; 
  // např. "https://app.scrapingbee.com/api/v1"
  if (!apiKey || !apiBase) {
    console.warn("Missing SCRAPING_API_KEY or SCRAPING_API_BASE_URL");
    return [];
  }
  const pageUrls = buildListingPageUrls(storeUrl, MAX_PAGES);
  const allProducts: RawScrapedProduct[] = [];
  for (const pageUrl of pageUrls) {
    const apiUrl = `${apiBase}?api_key=${encodeURIComponent(
      apiKey
    )}&url=${encodeURIComponent(pageUrl)}&render_js=false`;
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        console.error("scrapeViaApiListing status", res.status, pageUrl);
        continue;
      }
      const html = await res.text();
      const pageProducts = parseListingHtml(html, storeUrl);
      if (pageProducts.length === 0) {
        // pokud nic nenašlo, tak tu stránku ignorujeme a zkusíme další
        continue;
      }
      allProducts.push(...pageProducts);
      // Když je na stránce málo produktů, pravděpodobně už jsme na konci → ukončíme dřív
      if (pageProducts.length < MIN_PRODUCTS_TO_CONTINUE) {
        break;
      }
    } catch (error) {
      console.error("scrapeViaApiListing error:", error, pageUrl);
      continue;
    }
  }
  return dedupeByUrl(allProducts);
}

/**
 * Zkusíme vytvořit seznam page URL:
 * - když URL už má query, použijeme &page=
 * - jinak ?page=
 */
function buildListingPageUrls(baseUrl: string, maxPages: number): string[] {
  const urls: string[] = [];
  for (let page = 1; page <= maxPages; page++) {
    if (page === 1) {
      urls.push(baseUrl);
    } else {
      const sep = baseUrl.includes("?") ? "&" : "?";
      urls.push(`${baseUrl}${sep}page=${page}`);
    }
  }
  return urls;
}

function dedupeByUrl(products: RawScrapedProduct[]): RawScrapedProduct[] {
  const seen = new Set<string>();
  const result: RawScrapedProduct[] = [];
  for (const p of products) {
    if (!p.url) continue;
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    result.push(p);
  }
  return result;
}

/**
 * Obecný HTML parser pro většinu e-shopů:
 * - hledá karty produktů podle typických class/atributů
 * - z nich vytáhne:
 *   - název
 *   - cenu (v čísle, bez měny)
 *   - URL
 */
function parseListingHtml(html: string, baseUrl: string): RawScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: RawScrapedProduct[] = [];
  // Kandidáti na wrapper element produktu
  const productSelectors = [
    "[data-product-id]",
    "[data-product]",
    ".product-item",
    ".product-card",
    ".product",
    ".product-tile",
    ".product-grid-item",
  ];
  let productNodes: cheerio.Cheerio | null = null;
  for (const sel of productSelectors) {
    const found = $(sel);
    if (found.length > 3) {
      productNodes = found;
      break;
    }
  }
  if (!productNodes || productNodes.length === 0) {
    return [];
  }
  productNodes.each((_, el) => {
    const node = $(el);
    // Název – typické selektory
    const nameSelectors = [
      ".product-title",
      ".product-name",
      ".card-title",
      "h2 a",
      "h3 a",
      "h2",
      "h3",
      "a[title]",
    ];
    let name: string | null = null;
    for (const sel of nameSelectors) {
      const text = node.find(sel).first().text().trim();
      if (text) {
        name = text;
        break;
      }
    }
    if (!name) return;
    // URL produktu – hledáme první <a> s href
    let url: string | null = null;
    const link = node.find("a[href]").first();
    if (link && link.attr("href")) {
      url = absoluteUrl(baseUrl, link.attr("href")!);
    }
    if (!url) return;
    // Cena – zkusíme několik selektorů / atributů
    const priceSelectors = [
      ".price",
      ".product-price",
      "[data-price]",
      "[data-product-price]",
      ".price__current",
    ];
    let price: number | null = null;
    for (const sel of priceSelectors) {
      const priceNode = node.find(sel).first();
      if (!priceNode || priceNode.length === 0) continue;
      const rawText = priceNode.text().trim() || priceNode.attr("data-price") || "";
      const parsed = parsePrice(rawText);
      if (parsed !== null) {
        price = parsed;
        break;
      }
    }
    products.push({
      name,
      price,
      url,
      raw: {
        source: "html-listing",
      },
    });
  });
  return products;
}

function absoluteUrl(base: string, href: string): string {
  try {
    // Pokud je href už absolutní URL
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }
    const baseUrl = new URL(base);
    return new URL(href, `${baseUrl.protocol}//${baseUrl.host}`).toString();
  } catch {
    return href;
  }
}

/**
 * Vytáhne číslo z textu typu:
 * "1 299 Kč", "$19.99", "€ 12,50" atd.
 */
function parsePrice(str: string): number | null {
  if (!str) return null;
  // odstraníme měny a písmena, necháme číslice, tečku, čárku
  const cleaned = str
    .replace(/[^\d.,-]+/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return null;
  // Pokud je tam oboje , i . -> vezmeme poslední jako desetinný oddělovač
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    // vezmeme ten, který je dál vpravo
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
  if (Number.isNaN(n)) return null;
  return n;
}

