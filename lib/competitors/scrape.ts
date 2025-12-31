import * as cheerio from "cheerio";
import { detectPlatformFromUrl } from "./platform";
import { scrapeShopifyStore } from "./shopify";

export type RawScrapedProduct = {
  name: string;
  url: string;
  price: number | null;
  currency: string;
  external_id?: string | null;
  raw?: any;
};

const MAX_SEEDS = 80;
const MAX_PAGES_PER_SEED = 40;
const MAX_TOTAL_PRODUCTS = 1200;
const MIN_PRODUCTS_PER_PAGE = 3;
const MAX_VISITED_PAGES = 80;

/**
 * Normalize competitorUrl to origin + basePath (strip trailing slash)
 */
function normalizeCompetitorUrl(url: string): { origin: string; basePath: string } {
  try {
    const urlObj = new URL(url);
    const origin = `${urlObj.protocol}//${urlObj.hostname}`;
    let basePath = urlObj.pathname;
    // Strip trailing slash
    if (basePath.endsWith('/') && basePath.length > 1) {
      basePath = basePath.slice(0, -1);
    }
    // Ensure basePath starts with /
    if (!basePath.startsWith('/')) {
      basePath = '/' + basePath;
    }
    return { origin, basePath };
  } catch {
    // Fallback if URL parsing fails
    const origin = url.split('/').slice(0, 3).join('/');
    const pathMatch = url.match(/\/\/[^\/]+(\/.*)/);
    let basePath = pathMatch ? pathMatch[1] : '/';
    if (basePath.endsWith('/') && basePath.length > 1) {
      basePath = basePath.slice(0, -1);
    }
    return { origin, basePath };
  }
}

/**
 * Normalize URL: strip hash and drop tracking params (utm_*, gclid, fbclid)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove hash
    urlObj.hash = '';
    // Remove tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}

export async function scrapeCompetitorProducts(storeUrl: string): Promise<RawScrapedProduct[]> {
  const platform = detectPlatformFromUrl(storeUrl);

  // Shopify fast-path
  if (platform === "SHOPIFY") {
    const shopify = await scrapeShopifyStore(storeUrl);
    if (shopify?.length) return shopify.map(p => ({
      name: p.name,
      url: p.url,
      price: p.price ?? null,
      currency: (p.raw?.currency as string) || "USD",
      external_id: p.external_id ?? null,
      raw: p.raw,
    }));
  }

  // Normalize competitorUrl to origin + basePath
  const { origin, basePath } = normalizeCompetitorUrl(storeUrl);

  // General HTML crawler: frontier BFS crawler
  const map = new Map<string, RawScrapedProduct>();
  await crawlFrontier(storeUrl, storeUrl, map, origin, basePath);
  return Array.from(map.values());
}

// ----------------------
// Frontier crawler
// ----------------------
async function crawlFrontier(
  startUrl: string,
  baseUrl: string,
  map: Map<string, RawScrapedProduct>,
  origin: string,
  basePath: string
) {
  const queue: string[] = [startUrl];
  const visited = new Set<string>();
  const normalizedVisited = new Set<string>(); // For deduplication using normalized URLs

  while (queue.length && visited.size < MAX_VISITED_PAGES && map.size < MAX_TOTAL_PRODUCTS) {
    const url = queue.shift()!;
    const normalizedUrl = normalizeUrl(url);
    
    // Skip if already visited (using normalized URL for deduplication)
    if (normalizedVisited.has(normalizedUrl)) continue;
    normalizedVisited.add(normalizedUrl);
    visited.add(url);

    let html: string | null;
    try {
      html = await fetchHtml(url, false);
      if (!html) continue;
    } catch (error: any) {
      // If blocking error on first page, propagate it
      if (error?.isBlocked || error?.message === "SITE_BLOCKED") {
        throw error;
      }
      // Otherwise, skip this URL and continue
      continue;
    }

    let products = parseProductsFromListing(html, baseUrl);

    // retry with render_js if we got nothing and html seems thin
    if (products.length === 0 && html.length < 2000) {
      try {
        const js = await fetchHtml(url, true);
        if (js) {
          html = js;
          products = parseProductsFromListing(html, baseUrl);
        }
      } catch (error: any) {
        // If blocking error, propagate it
        if (error?.isBlocked || error?.message === "SITE_BLOCKED") {
          throw error;
        }
        // Otherwise, continue with existing html
      }
    }

    for (const p of products) {
      if (!p.url) continue;
      if (!map.has(p.url)) map.set(p.url, p);
    }

    const links = extractCandidateLinksFromPage(html, url, baseUrl, origin, basePath);

    for (const link of links) {
      const normalizedLink = normalizeUrl(link);
      // Skip if already visited (using normalized URL)
      if (normalizedVisited.has(normalizedLink)) continue;
      // Skip if already in queue (using normalized URL)
      if (queue.some(q => normalizeUrl(q) === normalizedLink)) continue;
      queue.push(link);
      if (queue.length > 600) break; // safety
    }
  }

  console.log("[scrape] frontier done", {
    startUrl,
    visited: visited.size,
    queueLeft: queue.length,
    products: map.size,
    sampleVisited: Array.from(visited).slice(0, 10),
  });
}

function extractCandidateLinksFromPage(
  html: string,
  currentUrl: string,
  baseUrl: string,
  origin: string,
  basePath: string
): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();

  // 1) Pagination / next
  const relNext = $("a[rel='next'][href]").attr("href");
  if (relNext) {
    const abs = absoluteUrl(currentUrl, relNext);
    if (abs) out.add(abs);
  }

  $("ul.pagination a[href], a.next[href], a[aria-label*='Next'][href], a[aria-label*='next'][href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = absoluteUrl(currentUrl, href);
    if (abs) out.add(abs);
  });

  // 2) Category tiles / side lists (GENERAL patterns)
  const categorySelectors = [
    ".list-group a[href]",          // VERY common (and used by webscraper.io)
    ".categories a[href]",
    ".category a[href]",
    ".subcategory a[href]",
    "aside a[href]",
    ".sidebar a[href]",
    ".sidebar-nav a[href]",
    "nav a[href]",
  ];

  for (const sel of categorySelectors) {
    $(sel).each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = absoluteUrl(currentUrl, href);
      if (abs) out.add(abs);
    });
  }

  // 3) Fallback: any internal links that look like category/listing paths
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = absoluteUrl(currentUrl, href);
    if (!abs) return;

    const low = abs.toLowerCase();
    if (
      low.includes("category") ||
      low.includes("categories") ||
      low.includes("collection") ||
      low.includes("collections") ||
      low.includes("/shop") ||
      low.includes("/products?") ||
      low.includes("cat=") ||
      low.includes("page=")
    ) {
      out.add(abs);
    }
  });

  // Normalize + filter
  const filtered: string[] = [];
  let originHostname: string;
  try {
    const originUrl = new URL(origin);
    originHostname = originUrl.hostname;
  } catch {
    // Fallback: extract hostname from origin string
    const match = origin.match(/\/\/([^\/]+)/);
    originHostname = match ? match[1] : '';
  }

  for (const u of out) {
    if (!u) continue;
    
    try {
      const urlObj = new URL(u);
      
      // Filter: same hostname
      if (urlObj.hostname !== originHostname) continue;
      
      // Filter: pathname starts with basePath
      if (!urlObj.pathname.startsWith(basePath)) continue;
    } catch {
      // Skip invalid URLs
      continue;
    }
    
    if (looksLikeAssetOrAuth(u)) continue;
    filtered.push(u);
  }

  // Deduplicate using normalized URLs
  const normalized = new Set<string>();
  const deduplicated: string[] = [];
  for (const u of filtered) {
    const norm = normalizeUrl(u);
    if (!normalized.has(norm)) {
      normalized.add(norm);
      deduplicated.push(u);
    }
  }

  return deduplicated;
}

async function crawlSeed(seedUrl: string, baseUrl: string, map: Map<string, RawScrapedProduct>) {
  let current: string | null = seedUrl;
  let pages = 0;

  while (current && pages < MAX_PAGES_PER_SEED && map.size < MAX_TOTAL_PRODUCTS) {
    pages++;

    let html: string | null;
    try {
      html = await fetchHtml(current, false);
      if (!html) break;
    } catch (error: any) {
      // If blocking error on first page, propagate it
      if (error?.isBlocked || error?.message === "SITE_BLOCKED") {
        throw error;
      }
      // Otherwise, break this seed
      break;
    }

    let products = parseProductsFromListing(html, baseUrl);

    // Debug: log when 0 products found
    if (products.length === 0) {
      const $ = cheerio.load(html);
      const title = $("title").first().text().trim();
      const c1 = $(".thumbnail").length;
      const c2 = $(".product-item").length;
      const c3 = $("[data-product-id]").length;
      console.warn("[scrape] 0 products on page", { url: current, title, counts: { thumbnail: c1, productItem: c2, dataProductId: c3 } });
    }

    // Retry with render_js if page looks empty or blocked
    if (products.length < MIN_PRODUCTS_PER_PAGE) {
      try {
        const retry = await fetchHtml(current, true);
        if (retry) {
          html = retry;
          products = parseProductsFromListing(retry, baseUrl);
        }
      } catch (error: any) {
        // If blocking error, propagate it
        if (error?.isBlocked || error?.message === "SITE_BLOCKED") {
          throw error;
        }
        // Otherwise, continue with existing html
      }
    }

    for (const p of products) {
      if (!p.url) continue;
      if (!map.has(p.url)) map.set(p.url, p);
    }

    current = findNextPageUrl(html, current, baseUrl);
  }
}

// ----------------------
// Seed validation
// ----------------------
async function validateListingSeeds(candidates: string[], baseUrl: string): Promise<string[]> {
  const scored: { url: string; count: number }[] = [];
  const subset = candidates.slice(0, 250);

  let idx = 0;
  const concurrency = 10;

  async function worker() {
    while (idx < subset.length) {
      const i = idx++;
      const url = subset[i];

      const html = await fetchHtml(url, false);
      if (!html) continue;

      const count = parseProductsFromListing(html, baseUrl).length;
      if (count < 1) continue;

      const $ = cheerio.load(html);
      const hasProductSignals =
        $(".thumbnail").length > 0 ||
        $("[data-product-id]").length > 0 ||
        $(".product").length > 0 ||
        $(".product-item").length > 0 ||
        $(".product-card").length > 0;

      if (!hasProductSignals) continue;

      scored.push({ url, count });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  scored.sort((a, b) => b.count - a.count);

  return dedupeUrls(scored.map(s => s.url)).slice(0, MAX_SEEDS);
}

// ----------------------
// Seed discovery (2-tier: nav first, then all)
// ----------------------
function discoverSeedListingUrls(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);

  const collect = (selector: string) => {
    const s = new Set<string>();
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = absoluteUrl(baseUrl, href);
      if (!abs) return;
      if (!sameHost(abs, baseUrl)) return;
      if (looksLikeAssetOrAuth(abs)) return;
      s.add(abs);
    });
    return Array.from(s);
  };

  const navSel =
    "nav a[href], header a[href], aside a[href], .sidebar a[href], .sidebar-nav a[href], .nav a[href], .navbar a[href], .menu a[href], [role='navigation'] a[href], .sidebar-nav .nav > li > ul a[href], li.dropdown a[href], .dropdown-menu a[href]";
  const nav = collect(navSel);

  if (nav.length >= 5) return nav.slice(0, 2000);

  const all = collect("a[href]");
  return all.slice(0, 2000);
}

function looksLikeAssetOrAuth(url: string): boolean {
  const u = url.toLowerCase();
  if (
    u.includes("/cart") || u.includes("/checkout") ||
    u.includes("/account") || u.includes("/login") ||
    u.includes("/register") || u.includes("/signin") ||
    u.includes("/logout") || u.includes("/wishlist")
  ) return true;

  if (
    u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp") ||
    u.endsWith(".svg") || u.endsWith(".css") || u.endsWith(".js") || u.endsWith(".ico") ||
    u.includes("cdn")
  ) return true;

  return false;
}

// ----------------------
// Seed expansion helpers
// ----------------------
function extractInternalLinksFromPage(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = absoluteUrl(baseUrl, href);
    if (!abs) return;
    if (!sameHost(abs, baseUrl)) return;
    if (looksLikeAssetOrAuth(abs)) return;
    out.add(abs);
  });
  return Array.from(out);
}

function looksLikeListingPage(html: string, baseUrl: string): boolean {
  // use existing parseProductsFromListing
  return parseProductsFromListing(html, baseUrl).length >= 1;
}

function looksLikeCategoryHub(html: string): boolean {
  const $ = cheerio.load(html);
  // category hub pages often have many internal tiles/cards but few products
  const tileSignals =
    $("a[href*='/category']").length +
    $("a[href*='/categories']").length +
    $("a[href*='/shop']").length +
    $("a[href*='/products']").length +
    $(".category").length +
    $(".categories").length +
    $(".subcategory").length +
    $(".list-group a[href]").length +
    $(".sidebar-nav a[href]").length;

  return tileSignals >= 5;
}

async function expandSeedsBFS(initialSeeds: string[], baseUrl: string): Promise<string[]> {
  const seeds = new Set<string>(initialSeeds);
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = initialSeeds.map(u => ({ url: u, depth: 0 }));

  const maxVisitedPages = 40;
  const maxDepth = 2;

  while (queue.length && visited.size < maxVisitedPages && seeds.size < MAX_SEEDS) {
    const item = queue.shift();
    if (!item) break;
    const { url, depth } = item;
    if (visited.has(url)) continue;
    visited.add(url);

    let html = await fetchHtml(url, false);
    if (!html) continue;

    // if page has zero products and looks empty, try render_js once
    if (parseProductsFromListing(html, baseUrl).length === 0 && html.length < 2000) {
      const js = await fetchHtml(url, true);
      if (js) html = js;
    }

    const links = extractInternalLinksFromPage(html, baseUrl);

    for (const link of links) {
      if (seeds.size >= MAX_SEEDS) break;
      if (seeds.has(link)) continue;

      // validate candidate link quickly
      const h = await fetchHtml(link, false);
      if (!h) continue;

      if (looksLikeListingPage(h, baseUrl) || looksLikeCategoryHub(h)) {
        seeds.add(link);
        if (depth + 1 <= maxDepth) queue.push({ url: link, depth: depth + 1 });
      }
    }
  }

  return Array.from(seeds);
}

// ----------------------
// Product parsing (cards)
// ----------------------
function parseProductsFromListing(html: string, baseUrl: string): RawScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: RawScrapedProduct[] = [];

  const cardSelectors = [
    "[data-product-id]",
    "[data-product]",
    ".product-grid-item",
    ".product-item",
    ".product-card",
    ".product",
    ".product-tile",
    ".grid-product",
    ".thumbnail",
    "li.product",
  ];

  let cards: cheerio.Cheerio<any> | null = null;
  for (const sel of cardSelectors) {
    const found = $(sel);
    if (found.length >= 1) { cards = found; break; }
  }
  if (!cards) return [];

  cards.each((_, el) => {
    const node = $(el);

    // URL: best guess link inside card
    const link =
      node.find("a[href*='/product']").first().attr("href") ||
      node.find("a[href*='/products']").first().attr("href") ||
      node.find("a[href*='/p/']").first().attr("href") ||
      node.find("a[href]").first().attr("href");

    if (!link) return;

    const url = absoluteUrl(baseUrl, link);
    if (!url) return;

    // Name
    const nameSelectors = [
      ".product-title",
      ".product-name",
      ".card-title",
      ".title",
      ".caption a.title",
      "h2 a",
      "h3 a",
      "h2",
      "h3",
      "a[title]",
    ];

    let name = "";
    for (const sel of nameSelectors) {
      const t = node.find(sel).first().text().trim();
      if (t) { name = t; break; }
    }
    if (!name) {
      name = node.find("a[title]").first().attr("title")?.trim() || "";
    }
    if (!name) return;

    // Guard: If name looks like a price, try to get title from link text as fallback
    const pricePattern = /^\s*\$?\s*\d+(\.\d+)?\s*$/;
    if (pricePattern.test(name)) {
      // Try to get title from link text as fallback
      const linkText = node.find("a[href]").first().text().trim();
      if (linkText && !pricePattern.test(linkText) && linkText.length > 2) {
        name = linkText;
      } else {
        // If still looks like price or link text is also invalid, skip this product
        // It will be caught by validation in insertion points, but skip here to avoid bad data
        return;
      }
    }

    // Price (optional)
    const priceSelectors = [".price", ".product-price", ".money", ".amount", "[data-price]", "[data-product-price]", ".current-price", "h4.price"];
    let price: number | null = null;
    let currency = "USD";

    for (const sel of priceSelectors) {
      const n = node.find(sel).first();
      if (!n || n.length === 0) continue;
      const raw = (n.text().trim() || n.attr("data-price") || n.attr("data-product-price") || "").trim();
      const parsed = parsePriceWithCurrency(raw);
      if (parsed.price !== null) {
        price = parsed.price;
        currency = parsed.currency;
        break;
      }
    }

    products.push({
      name,
      url,
      price,
      currency,
      raw: { source: "html-listing" },
    });
  });

  return products;
}

// ----------------------
// Pagination detection
// ----------------------
function findNextPageUrl(html: string, currentUrl: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  const relNext = $("a[rel='next'][href]").attr("href");
  if (relNext) return absoluteUrl(currentUrl, relNext);

  const activeNext = $("ul.pagination li.active").next("li").find("a[href]").attr("href");
  if (activeNext) return absoluteUrl(currentUrl, activeNext);

  const nextClass = $("a.next[href], a[aria-label*='Next'][href], a[aria-label*='next'][href]").first().attr("href");
  if (nextClass) return absoluteUrl(currentUrl, nextClass);

  // Text fallback
  let found: string | null = null;
  $("a[href]").each((_, a) => {
    const text = $(a).text().trim().toLowerCase();
    if (text === "next" || text === "›" || text === "»" || text.includes("next page")) {
      const href = $(a).attr("href");
      if (href) found = absoluteUrl(currentUrl, href);
    }
  });

  if (found && sameHost(found, baseUrl)) return found;
  return null;
}

// ----------------------
// Fetch helpers
// ----------------------
/**
 * Determine if we should use direct fetch (localhost/dev) or ScrapingBee (production)
 */
function shouldUseDirectFetch(): boolean {
  // Use direct fetch only in localhost/dev environments
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isLocalhost = process.env.NODE_ENV === "development" || 
                     process.env.VERCEL_ENV === "development" ||
                     appUrl.includes("localhost") ||
                     appUrl.includes("127.0.0.1");
  return isLocalhost;
}

async function fetchHtml(url: string, renderJs: boolean): Promise<string | null> {
  // render_js always requires ScrapingBee
  if (renderJs) return await fetchHtmlScrapingBee(url, true);

  // In production, use ScrapingBee directly (skip direct fetch to avoid blocking)
  if (!shouldUseDirectFetch()) {
    return await fetchHtmlScrapingBee(url, false);
  }

  // In localhost/dev: try direct fetch first, then fallback to ScrapingBee
  try {
    const direct = await fetchHtmlDirect(url);
    if (direct && direct.length > 500) return direct;
  } catch (error: any) {
    // If direct fetch throws SITE_BLOCKED error, propagate it
    if (error?.isBlocked || error?.message === "SITE_BLOCKED") {
      throw error;
    }
    // Otherwise, fall through to ScrapingBee
  }

  // Fallback to ScrapingBee
  return await fetchHtmlScrapingBee(url, false);
}

async function fetchHtmlDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // quick sanity check: must look like HTML
    if (!html || !html.includes("<html")) return null;
    return html;
  } catch (error: any) {
    // Check for socket/connection errors that indicate blocking
    const errorMessage = error?.message || String(error || "");
    const errorCode = error?.code || "";
    
    if (
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("UND_ERR_SOCKET") ||
      errorCode === "UND_ERR_SOCKET" ||
      errorCode === "ECONNREFUSED" ||
      errorCode === "ETIMEDOUT"
    ) {
      // Re-throw as a specific error that indicates blocking
      const blockedError = new Error("SITE_BLOCKED");
      (blockedError as any).isBlocked = true;
      throw blockedError;
    }
    return null;
  }
}

async function fetchHtmlScrapingBee(url: string, renderJs: boolean): Promise<string | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.warn("[scrape] Missing SCRAPINGBEE_API_KEY");
    return null;
  }

  const apiUrl =
    `https://app.scrapingbee.com/api/v1?api_key=${encodeURIComponent(apiKey)}` +
    `&url=${encodeURIComponent(url)}` +
    `&render_js=${renderJs ? "true" : "false"}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ----------------------
// Utils
// ----------------------
function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function sameHost(url: string, base: string): boolean {
  try {
    return new URL(url).host === new URL(base).host;
  } catch {
    return false;
  }
}

function absoluteUrl(base: string, href: string): string | null {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    const b = new URL(base);
    return new URL(href, `${b.protocol}//${b.host}`).toString();
  } catch {
    return null;
  }
}

function parsePriceWithCurrency(str: string): { price: number | null; currency: string } {
  if (!str) return { price: null, currency: "USD" };

  let currency = "USD";
  if (str.includes("$")) currency = "USD";
  else if (str.includes("£")) currency = "GBP";
  else if (str.includes("€")) currency = "EUR";

  const cleaned = str.replace(/[^\d.,-]+/g, "").replace(/\s+/g, "").trim();
  if (!cleaned) return { price: null, currency };

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const n = Number(normalized);
  if (Number.isNaN(n)) return { price: null, currency };
  return { price: n, currency };
}
