/**
 * Pure scraper function for competitor product listings.
 * No Supabase calls - just scraping logic.
 * 
 * @param listingUrl - The competitor store URL to scrape
 * @returns Array of scraped products with url, name, price, currency, and raw data
 */
import { scrapeCompetitorProducts as scrapeProducts } from "@/lib/competitors/scrape";
import type { RawScrapedProduct } from "@/lib/competitors/scrape";

export type ScrapedProduct = {
  url: string;
  name: string;
  price: number | null;
  currency: string;
  raw?: any;
};

export async function scrapeCompetitorProducts(listingUrl: string): Promise<ScrapedProduct[]> {
  const rawProducts = await scrapeProducts(listingUrl);
  
  // Map to the requested format
  return rawProducts.map((p): ScrapedProduct => ({
    url: p.url,
    name: p.name,
    price: p.price,
    currency: p.currency || "USD",
    raw: p.raw,
  }));
}

