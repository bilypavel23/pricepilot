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

export class ScrapingBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapingBlockedError";
  }
}

export async function scrapeCompetitorProducts(listingUrl: string): Promise<ScrapedProduct[]> {
  try {
    const rawProducts = await scrapeProducts(listingUrl);
    
    // Map to the requested format
    return rawProducts.map((p): ScrapedProduct => ({
      url: p.url,
      name: p.name,
      price: p.price,
      currency: p.currency || "USD",
      raw: p.raw,
    }));
  } catch (error: any) {
    // Check if the error indicates blocking
    if (error?.isBlocked || error?.message === "SITE_BLOCKED") {
      throw new ScrapingBlockedError("Site blocks automated scraping");
    }
    // Re-throw other errors
    throw error;
  }
}

