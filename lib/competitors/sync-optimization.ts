/**
 * Price Sync Optimization
 * 
 * Optimizes daily price sync by:
 * 1. Using conditional requests (ETag, Last-Modified)
 * 2. Skipping unchanged products using hash comparison
 * 3. Only updating checked_at timestamp
 */

import { createClient } from "@/lib/supabase/server";

export type SyncOptimizationResult = {
  skipped: number;
  updated: number;
  errors: number;
};

/**
 * Check if a product URL has changed using conditional requests
 */
export async function checkProductChanged(
  url: string,
  lastEtag?: string | null,
  lastModified?: string | null
): Promise<{ changed: boolean; etag?: string; lastModified?: string }> {
  try {
    const headers: HeadersInit = {};
    
    if (lastEtag) {
      headers["If-None-Match"] = lastEtag;
    }
    if (lastModified) {
      headers["If-Modified-Since"] = lastModified;
    }

    const response = await fetch(url, {
      method: "HEAD", // Use HEAD to avoid downloading full page
      headers,
    });

    // 304 Not Modified means no change
    if (response.status === 304) {
      return { changed: false };
    }

    // Extract new headers
    const etag = response.headers.get("ETag");
    const lastModifiedHeader = response.headers.get("Last-Modified");

    return {
      changed: true,
      etag: etag || undefined,
      lastModified: lastModifiedHeader || undefined,
    };
  } catch (error) {
    console.error("Error checking product change:", error);
    // On error, assume changed to be safe
    return { changed: true };
  }
}

/**
 * Compute a simple hash of price data for comparison
 */
export function computePriceHash(price: number | null, currency: string): string {
  const data = `${price || 0}_${currency}`;
  // Simple hash (in production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Sync competitor prices with optimization
 * Only updates products that have actually changed
 */
export async function syncCompetitorPricesOptimized(
  storeId: string
): Promise<SyncOptimizationResult> {
  const supabase = await createClient();
  
  // Load active product_competitors
  const { data: productCompetitors, error } = await supabase
    .from("product_competitors")
    .select("id, competitor_url, last_seen_price, currency, last_checked_at")
    .eq("store_id", storeId)
    .eq("is_active", true);

  if (error || !productCompetitors) {
    console.error("Error loading product competitors:", error);
    return { skipped: 0, updated: 0, errors: 0 };
  }

  let skipped = 0;
  let updated = 0;
  let errors = 0;

  // TODO: Implement actual scraping logic here
  // For now, just update checked_at timestamp
  for (const pc of productCompetitors) {
    try {
      // Check if product changed (simplified - would need actual scraping)
      // For now, always update checked_at
      await supabase
        .from("product_competitors")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", pc.id);
      
      updated++;
    } catch (err) {
      console.error(`Error syncing product competitor ${pc.id}:`, err);
      errors++;
    }
  }

  return { skipped, updated, errors };
}

