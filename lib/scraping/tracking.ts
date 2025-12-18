/**
 * Price Tracking Worker
 * 
 * This module implements the price tracking logic with:
 * - Smart skipping based on no-change streaks
 * - Retry backoff for failed requests
 * - Budget enforcement
 * - Price change detection and history recording
 */

import { createClient } from "@/lib/supabase/server";
import * as cheerio from "cheerio";
import {
  BATCH_SIZE,
  calculateNextAllowedCheck,
  calculateRetryBackoff,
  getTrackingRunsPerDay,
  MAX_RETRIES,
  NO_CHANGE_STREAK_TO_SLOWDOWN,
} from "./config";
import { scrapeWithBudget, getOrCreateScrapeBudget, type ScrapeResult } from "./budget";

// ============================================================================
// TYPES
// ============================================================================

export interface CompetitorProductLink {
  id: string;
  user_id: string;
  store_id: string;
  product_id: string;
  competitor_id: string;
  competitor_product_url: string;
  last_price: number | null;
  last_currency: string | null;
  last_availability: boolean;
  last_checked_at: string | null;
  last_changed_at: string | null;
  no_change_streak: number;
  error_streak: number;
  next_allowed_check_at: string | null;
  is_active: boolean;
  needs_attention: boolean;
  priority: number;
}

export interface TrackingResult {
  linkId: string;
  url: string;
  success: boolean;
  priceChanged: boolean;
  newPrice: number | null;
  oldPrice: number | null;
  deferred: boolean;
  error?: string;
}

export interface TrackingJobResult {
  userId: string;
  storeId: string;
  linksProcessed: number;
  linksDeferred: number;
  priceChanges: number;
  errors: number;
  budgetExhausted: boolean;
  results: TrackingResult[];
}

// ============================================================================
// LINK SELECTION
// ============================================================================

/**
 * Get competitor product links that are due for tracking.
 * 
 * Selection criteria:
 * - is_active = true
 * - competitor_product_url is not null
 * - next_allowed_check_at is null OR <= now
 * 
 * Ordered by:
 * - last_checked_at ASC (oldest first, NULLs first)
 * - priority DESC (higher priority first)
 */
export async function getLinksForTracking(
  userId: string,
  storeId: string,
  limit: number = BATCH_SIZE
): Promise<CompetitorProductLink[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: links, error } = await supabase
    .from('competitor_product_links')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .not('competitor_product_url', 'is', null)
    .or(`next_allowed_check_at.is.null,next_allowed_check_at.lte.${now}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .order('priority', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching links for tracking:', error);
    return [];
  }

  return links || [];
}

/**
 * Count total trackable links for a user/store
 */
export async function countTrackableLinks(
  userId: string,
  storeId: string
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('competitor_product_links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .not('competitor_product_url', 'is', null);

  if (error) {
    console.error('Error counting trackable links:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// PRICE EXTRACTION
// ============================================================================

/**
 * Extract price from HTML content.
 * Uses multiple selectors to find the price.
 */
export function extractPriceFromHtml(html: string): {
  price: number | null;
  currency: string;
  availability: boolean;
} {
  const $ = cheerio.load(html);

  // Price selectors (ordered by specificity)
  const priceSelectors = [
    '[itemprop="price"]',
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    '[data-price]',
    '[data-product-price]',
    '.price__current',
    '.product-price',
    '.price',
    '[class*="price"]',
    '[class*="Price"]',
  ];

  let price: number | null = null;

  for (const selector of priceSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const priceText =
        element.attr('content') ||
        element.attr('data-price') ||
        element.text().trim();

      if (priceText) {
        const parsed = parsePrice(priceText);
        if (parsed !== null) {
          price = parsed;
          break;
        }
      }
    }
  }

  // Currency detection
  let currency = 'USD';
  const currencySelectors = [
    '[itemprop="priceCurrency"]',
    'meta[property="product:price:currency"]',
    'meta[property="og:price:currency"]',
  ];

  for (const selector of currencySelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const currencyText = element.attr('content') || element.text().trim();
      if (currencyText) {
        currency = currencyText.toUpperCase();
        break;
      }
    }
  }

  // Availability detection
  let availability = true;
  const outOfStockIndicators = [
    'out of stock',
    'sold out',
    'unavailable',
    'not available',
    'vyprodáno',
    'nedostupné',
  ];

  const bodyText = $('body').text().toLowerCase();
  for (const indicator of outOfStockIndicators) {
    if (bodyText.includes(indicator)) {
      availability = false;
      break;
    }
  }

  return { price, currency, availability };
}

/**
 * Parse price string to number
 */
function parsePrice(str: string): number | null {
  if (!str) return null;

  // Remove currency symbols and letters, keep digits, dots, commas
  const cleaned = str
    .replace(/[^\d.,-]+/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) return null;

  // Handle both comma and dot as decimal separators
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }

  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

// ============================================================================
// LINK UPDATE
// ============================================================================

/**
 * Update a competitor product link after tracking
 */
export async function updateLinkAfterTracking(
  linkId: string,
  result: {
    success: boolean;
    price: number | null;
    currency: string;
    availability: boolean;
    error?: string;
  }
): Promise<void> {
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Get current link state
  const { data: link, error: fetchError } = await supabase
    .from('competitor_product_links')
    .select('last_price, no_change_streak, error_streak')
    .eq('id', linkId)
    .single();

  if (fetchError || !link) {
    console.error('Error fetching link for update:', fetchError);
    return;
  }

  const updates: Record<string, any> = {
    updated_at: nowIso,
  };

  if (result.success && result.price !== null) {
    // Successful scrape with valid price
    const priceChanged = link.last_price !== result.price;

    updates.last_price = result.price;
    updates.last_currency = result.currency;
    updates.last_availability = result.availability;
    updates.last_checked_at = nowIso;
    updates.error_streak = 0;
    updates.last_error_message = null;

    if (priceChanged) {
      // Price changed - reset streak, record change
      updates.last_changed_at = nowIso;
      updates.no_change_streak = 0;
      updates.next_allowed_check_at = null; // Return to normal frequency
    } else {
      // Price unchanged - increment streak
      const newStreak = (link.no_change_streak || 0) + 1;
      updates.no_change_streak = newStreak;

      // Apply smart skipping
      const nextCheck = calculateNextAllowedCheck(newStreak, now);
      updates.next_allowed_check_at = nextCheck?.toISOString() || null;
    }

    // Record price history
    await recordPriceHistory(linkId, result.price, result.currency, result.availability);
  } else {
    // Failed scrape
    const newErrorStreak = (link.error_streak || 0) + 1;
    updates.error_streak = newErrorStreak;
    updates.last_error_at = nowIso;
    updates.last_error_message = result.error || 'Unknown error';

    // Apply retry backoff
    const nextRetry = calculateRetryBackoff(newErrorStreak, now);
    updates.next_allowed_check_at = nextRetry.toISOString();

    // Mark as needing attention if all retries exhausted
    if (newErrorStreak > MAX_RETRIES) {
      updates.needs_attention = true;
    }
  }

  const { error: updateError } = await supabase
    .from('competitor_product_links')
    .update(updates)
    .eq('id', linkId);

  if (updateError) {
    console.error('Error updating link after tracking:', updateError);
  }
}

/**
 * Record price history entry
 */
async function recordPriceHistory(
  linkId: string,
  price: number,
  currency: string,
  availability: boolean
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('competitor_price_history')
    .insert({
      competitor_product_link_id: linkId,
      price,
      currency,
      availability,
    });

  if (error) {
    console.error('Error recording price history:', error);
  }
}

// ============================================================================
// TRACKING WORKER
// ============================================================================

/**
 * Run price tracking for a user's store.
 * 
 * This is the main entry point for the tracking job.
 * It processes links in batches, respecting budget limits.
 */
export async function runTrackingJob(
  userId: string,
  storeId: string,
  plan: string | null
): Promise<TrackingJobResult> {
  const result: TrackingJobResult = {
    userId,
    storeId,
    linksProcessed: 0,
    linksDeferred: 0,
    priceChanges: 0,
    errors: 0,
    budgetExhausted: false,
    results: [],
  };

  // Check if tracking is enabled for this plan
  const runsPerDay = getTrackingRunsPerDay(plan);
  if (runsPerDay <= 0) {
    return result;
  }

  // Get budget status
  const budget = await getOrCreateScrapeBudget(userId);
  if (!budget.canScrape) {
    result.budgetExhausted = true;
    return result;
  }

  // Process links in batches
  let hasMore = true;
  while (hasMore && !result.budgetExhausted) {
    const links = await getLinksForTracking(userId, storeId, BATCH_SIZE);
    
    if (links.length === 0) {
      hasMore = false;
      break;
    }

    for (const link of links) {
      // Check budget before each request
      const currentBudget = await getOrCreateScrapeBudget(userId);
      if (!currentBudget.canScrape) {
        result.budgetExhausted = true;
        result.linksDeferred++;
        result.results.push({
          linkId: link.id,
          url: link.competitor_product_url,
          success: false,
          priceChanged: false,
          newPrice: null,
          oldPrice: link.last_price,
          deferred: true,
          error: 'Budget exhausted',
        });
        break;
      }

      // Scrape the URL
      const scrapeResult = await scrapeWithBudget(userId, link.competitor_product_url);

      if (scrapeResult.deferred) {
        result.budgetExhausted = true;
        result.linksDeferred++;
        result.results.push({
          linkId: link.id,
          url: link.competitor_product_url,
          success: false,
          priceChanged: false,
          newPrice: null,
          oldPrice: link.last_price,
          deferred: true,
          error: scrapeResult.error,
        });
        break;
      }

      if (!scrapeResult.success || !scrapeResult.data) {
        // Scrape failed
        result.errors++;
        await updateLinkAfterTracking(link.id, {
          success: false,
          price: null,
          currency: 'USD',
          availability: true,
          error: scrapeResult.error,
        });
        result.results.push({
          linkId: link.id,
          url: link.competitor_product_url,
          success: false,
          priceChanged: false,
          newPrice: null,
          oldPrice: link.last_price,
          deferred: false,
          error: scrapeResult.error,
        });
        continue;
      }

      // Extract price from HTML
      const extracted = extractPriceFromHtml(scrapeResult.data);

      if (extracted.price === null) {
        // Could not extract price
        result.errors++;
        await updateLinkAfterTracking(link.id, {
          success: false,
          price: null,
          currency: extracted.currency,
          availability: extracted.availability,
          error: 'Could not extract price from page',
        });
        result.results.push({
          linkId: link.id,
          url: link.competitor_product_url,
          success: false,
          priceChanged: false,
          newPrice: null,
          oldPrice: link.last_price,
          deferred: false,
          error: 'Could not extract price from page',
        });
        continue;
      }

      // Successfully extracted price
      const priceChanged = link.last_price !== extracted.price;
      if (priceChanged) {
        result.priceChanges++;
      }

      await updateLinkAfterTracking(link.id, {
        success: true,
        price: extracted.price,
        currency: extracted.currency,
        availability: extracted.availability,
      });

      result.linksProcessed++;
      result.results.push({
        linkId: link.id,
        url: link.competitor_product_url,
        success: true,
        priceChanged,
        newPrice: extracted.price,
        oldPrice: link.last_price,
        deferred: false,
      });
    }

    // Check if we got fewer links than batch size (no more to process)
    if (links.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  return result;
}

// ============================================================================
// SCHEDULING HELPERS
// ============================================================================

/**
 * Check if a tracking run is allowed based on last run time and plan
 */
export async function canRunTracking(
  userId: string,
  storeId: string,
  plan: string | null
): Promise<{ allowed: boolean; reason?: string; nextAllowedAt?: Date }> {
  const runsPerDay = getTrackingRunsPerDay(plan);
  
  if (runsPerDay <= 0) {
    return { allowed: false, reason: 'Tracking not available on this plan' };
  }

  const hoursBetweenRuns = Math.floor(24 / runsPerDay);
  const supabase = await createClient();

  // Check last tracking run
  const { data: lastJob } = await supabase
    .from('scrape_jobs')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('job_type', 'tracking')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (lastJob?.completed_at) {
    const lastRun = new Date(lastJob.completed_at);
    const nextAllowed = new Date(lastRun.getTime() + hoursBetweenRuns * 60 * 60 * 1000);
    
    if (nextAllowed > new Date()) {
      return {
        allowed: false,
        reason: `Last run was too recent. Next allowed at ${nextAllowed.toISOString()}`,
        nextAllowedAt: nextAllowed,
      };
    }
  }

  return { allowed: true };
}

/**
 * Create a tracking job in the queue
 */
export async function createTrackingJob(
  userId: string,
  storeId: string,
  scheduledFor?: Date
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({
      user_id: userId,
      store_id: storeId,
      job_type: 'tracking',
      status: 'pending',
      scheduled_for: (scheduledFor || new Date()).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating tracking job:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Update tracking job status
 */
export async function updateTrackingJobStatus(
  jobId: string,
  status: 'in_progress' | 'completed' | 'failed' | 'deferred',
  result?: Partial<TrackingJobResult>
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    status,
    updated_at: now,
  };

  if (status === 'in_progress') {
    updates.started_at = now;
  }

  if (status === 'completed' || status === 'failed') {
    updates.completed_at = now;
  }

  if (result) {
    updates.items_processed = result.linksProcessed || 0;
    if (result.budgetExhausted) {
      updates.error_message = 'Budget exhausted';
    }
  }

  const { error } = await supabase
    .from('scrape_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('Error updating tracking job status:', error);
  }
}

