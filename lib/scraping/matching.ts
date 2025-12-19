/**
 * Matching Worker
 * 
 * This module implements the product matching logic with:
 * - Quick-start mode: immediately match top N products
 * - Batch queue: process remaining products in batches
 * - Rate limiting: max 1 heavy matching run per day per user
 * - Budget enforcement
 */

import { createClient } from "@/lib/supabase/server";
import {
  BATCH_SIZE,
  QUICK_START_MATCH_COUNT,
  HEAVY_MATCHING_RUNS_PER_DAY,
  MAX_NEW_COMPETITOR_STORES_PER_DAY,
  MAX_URL_ADDITIONS_PER_DAY,
} from "./config";
import { scrapeWithBudget, getOrCreateScrapeBudget } from "./budget";
import { scrapeCompetitorProducts, type RawScrapedProduct } from "@/lib/competitors/scrape";
import { findBestMatches } from "@/lib/competitors/matching";

// ============================================================================
// TYPES
// ============================================================================

export interface MatchingJobResult {
  userId: string;
  storeId: string;
  competitorId: string;
  productsMatched: number;
  productsDeferred: number;
  budgetExhausted: boolean;
  isQuickStart: boolean;
  batchNumber: number;
  totalBatches: number;
}

export interface RateLimitStatus {
  canRunHeavyMatching: boolean;
  canAddCompetitorStore: boolean;
  canAddUrls: boolean;
  heavyMatchingCount: number;
  competitorStoresAdded: number;
  urlsAdded: number;
  reason?: string;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Get or create rate limit record for today
 */
export async function getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Try to get existing record
  const { data: existing } = await supabase
    .from('user_matching_rate_limit')
    .select('*')
    .eq('user_id', userId)
    .eq('run_date', today)
    .single();

  if (existing) {
    return {
      canRunHeavyMatching: existing.heavy_matching_count < HEAVY_MATCHING_RUNS_PER_DAY,
      canAddCompetitorStore: existing.competitor_stores_added < MAX_NEW_COMPETITOR_STORES_PER_DAY,
      canAddUrls: existing.urls_added < MAX_URL_ADDITIONS_PER_DAY,
      heavyMatchingCount: existing.heavy_matching_count,
      competitorStoresAdded: existing.competitor_stores_added,
      urlsAdded: existing.urls_added,
    };
  }

  // Create new record for today
  const { error } = await supabase
    .from('user_matching_rate_limit')
    .insert({
      user_id: userId,
      run_date: today,
      heavy_matching_count: 0,
      competitor_stores_added: 0,
      urls_added: 0,
    });

  if (error) {
    console.error('Error creating rate limit record:', error);
  }

  return {
    canRunHeavyMatching: true,
    canAddCompetitorStore: true,
    canAddUrls: true,
    heavyMatchingCount: 0,
    competitorStoresAdded: 0,
    urlsAdded: 0,
  };
}

/**
 * Increment heavy matching count
 */
export async function incrementHeavyMatchingCount(userId: string): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Ensure record exists
  await getRateLimitStatus(userId);

  const { error } = await supabase
    .from('user_matching_rate_limit')
    .update({
      heavy_matching_count: supabase.rpc('increment', { x: 1 }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('run_date', today);

  // Fallback: direct increment if RPC not available
  if (error) {
    const { data: current } = await supabase
      .from('user_matching_rate_limit')
      .select('heavy_matching_count')
      .eq('user_id', userId)
      .eq('run_date', today)
      .single();

    if (current) {
      await supabase
        .from('user_matching_rate_limit')
        .update({
          heavy_matching_count: (current.heavy_matching_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('run_date', today);
    }
  }
}

/**
 * Increment competitor stores added count
 */
export async function incrementCompetitorStoresAdded(userId: string): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  await getRateLimitStatus(userId);

  const { data: current } = await supabase
    .from('user_matching_rate_limit')
    .select('competitor_stores_added')
    .eq('user_id', userId)
    .eq('run_date', today)
    .single();

  if (current) {
    await supabase
      .from('user_matching_rate_limit')
      .update({
        competitor_stores_added: (current.competitor_stores_added || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('run_date', today);
  }
}

/**
 * Increment URLs added count
 */
export async function incrementUrlsAdded(userId: string, count: number = 1): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  await getRateLimitStatus(userId);

  const { data: current } = await supabase
    .from('user_matching_rate_limit')
    .select('urls_added')
    .eq('user_id', userId)
    .eq('run_date', today)
    .single();

  if (current) {
    await supabase
      .from('user_matching_rate_limit')
      .update({
        urls_added: (current.urls_added || 0) + count,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('run_date', today);
  }
}

// ============================================================================
// PRODUCT LOADING
// ============================================================================

/**
 * Get products that need matching for a competitor
 */
export async function getProductsForMatching(
  storeId: string,
  competitorId: string,
  limit: number = BATCH_SIZE,
  offset: number = 0
): Promise<Array<{ id: string; name: string; sku: string | null }>> {
  const supabase = await createClient();

  // Get products that don't have a link to this competitor yet
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false }) // Most recently updated first
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching products for matching:', error);
    return [];
  }

  // Filter out products that already have a link to this competitor
  const productIds = (products || []).map(p => p.id);
  
  if (productIds.length === 0) {
    return [];
  }

  const { data: existingLinks } = await supabase
    .from('competitor_product_links')
    .select('product_id')
    .eq('competitor_id', competitorId)
    .in('product_id', productIds);

  const linkedProductIds = new Set((existingLinks || []).map(l => l.product_id));

  return (products || []).filter(p => !linkedProductIds.has(p.id));
}

/**
 * Count total products for a store
 */
export async function countProductsForStore(storeId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'active');

  if (error) {
    console.error('Error counting products:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// MATCHING LOGIC
// ============================================================================

/**
 * Create competitor product links from matches
 */
export async function createCompetitorProductLinks(
  userId: string,
  storeId: string,
  competitorId: string,
  matches: Array<{
    productId: string;
    competitorProductId: string;
    competitorProductUrl: string;
    similarity: number;
  }>
): Promise<number> {
  if (matches.length === 0) return 0;

  const supabase = await createClient();

  const links = matches.map(m => ({
    user_id: userId,
    store_id: storeId,
    product_id: m.productId,
    competitor_id: competitorId,
    competitor_product_id: m.competitorProductId,
    competitor_product_url: m.competitorProductUrl,
    is_active: true,
    priority: m.similarity >= 90 ? 1 : 0, // Higher priority for high-confidence matches
  }));

  const { error } = await supabase
    .from('competitor_product_links')
    .upsert(links, {
      onConflict: 'product_id,competitor_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error creating competitor product links:', error);
    return 0;
  }

  return links.length;
}

// ============================================================================
// QUICK START MATCHING
// ============================================================================

/**
 * Run quick-start matching for a new competitor.
 * Matches only the top N products immediately.
 */
export async function runQuickStartMatching(
  userId: string,
  storeId: string,
  competitorId: string,
  competitorUrl: string
): Promise<MatchingJobResult> {
  const result: MatchingJobResult = {
    userId,
    storeId,
    competitorId,
    productsMatched: 0,
    productsDeferred: 0,
    budgetExhausted: false,
    isQuickStart: true,
    batchNumber: 1,
    totalBatches: 1,
  };

  // Check budget
  const budget = await getOrCreateScrapeBudget(userId);
  if (!budget.canScrape) {
    result.budgetExhausted = true;
    return result;
  }

  // Get top products to match
  const products = await getProductsForMatching(storeId, competitorId, QUICK_START_MATCH_COUNT);
  
  if (products.length === 0) {
    return result;
  }

  // Scrape competitor products (this uses the existing scraper)
  // Note: scrapeCompetitorProducts already handles Shopify JSON API when possible
  const scrapedProducts = await scrapeCompetitorProducts(competitorUrl);

  if (scrapedProducts.length === 0) {
    return result;
  }

  // Find best matches
  const matches = findBestMatches(
    products.map(p => ({ id: p.id, name: p.name, sku: p.sku || undefined })),
    scrapedProducts.map(p => ({ 
      id: p.url || p.name, // Use URL as ID if available
      name: p.name, 
      sku: undefined 
    })),
    60 // minScore
  );

  // Create links for matches
  const linksToCreate = matches
    .filter(m => m.similarity >= 60)
    .map(m => {
      const scrapedProduct = scrapedProducts.find(p => (p.url || p.name) === m.competitorProductId);
      return {
        productId: m.productId,
        competitorProductId: m.competitorProductId,
        competitorProductUrl: scrapedProduct?.url || '',
        similarity: m.similarity,
      };
    })
    .filter(m => m.competitorProductUrl);

  result.productsMatched = await createCompetitorProductLinks(
    userId,
    storeId,
    competitorId,
    linksToCreate
  );

  // Queue remaining products for batch matching
  const totalProducts = await countProductsForStore(storeId);
  if (totalProducts > QUICK_START_MATCH_COUNT) {
    await queueBatchMatching(userId, storeId, competitorId, totalProducts);
  }

  return result;
}

// ============================================================================
// BATCH MATCHING
// ============================================================================

/**
 * Queue batch matching jobs for remaining products
 */
export async function queueBatchMatching(
  userId: string,
  storeId: string,
  competitorId: string,
  totalProducts: number
): Promise<void> {
  const supabase = await createClient();

  // Calculate number of batches needed
  const remainingProducts = totalProducts - QUICK_START_MATCH_COUNT;
  const totalBatches = Math.ceil(remainingProducts / BATCH_SIZE);

  // Create batch jobs
  const jobs = [];
  for (let i = 0; i < totalBatches; i++) {
    jobs.push({
      user_id: userId,
      store_id: storeId,
      competitor_id: competitorId,
      job_type: 'matching',
      status: 'pending',
      batch_number: i + 1,
      total_batches: totalBatches,
      items_total: Math.min(BATCH_SIZE, remainingProducts - i * BATCH_SIZE),
      // Schedule batches with increasing delays
      scheduled_for: new Date(Date.now() + (i + 1) * 5 * 60 * 1000).toISOString(), // 5 min apart
    });
  }

  if (jobs.length > 0) {
    const { error } = await supabase.from('scrape_jobs').insert(jobs);
    if (error) {
      console.error('Error queueing batch matching jobs:', error);
    }
  }
}

/**
 * Run a single batch matching job
 */
export async function runBatchMatching(
  userId: string,
  storeId: string,
  competitorId: string,
  batchNumber: number,
  competitorUrl: string
): Promise<MatchingJobResult> {
  const result: MatchingJobResult = {
    userId,
    storeId,
    competitorId,
    productsMatched: 0,
    productsDeferred: 0,
    budgetExhausted: false,
    isQuickStart: false,
    batchNumber,
    totalBatches: 0,
  };

  // Check rate limit
  const rateLimit = await getRateLimitStatus(userId);
  if (!rateLimit.canRunHeavyMatching) {
    result.productsDeferred = BATCH_SIZE;
    return result;
  }

  // Check budget
  const budget = await getOrCreateScrapeBudget(userId);
  if (!budget.canScrape) {
    result.budgetExhausted = true;
    return result;
  }

  // Get products for this batch
  const offset = QUICK_START_MATCH_COUNT + (batchNumber - 1) * BATCH_SIZE;
  const products = await getProductsForMatching(storeId, competitorId, BATCH_SIZE, offset);

  if (products.length === 0) {
    return result;
  }

  // Scrape competitor products
  const scrapedProducts = await scrapeCompetitorProducts(competitorUrl);

  if (scrapedProducts.length === 0) {
    return result;
  }

  // Find best matches
  const matches = findBestMatches(
    products.map(p => ({ id: p.id, name: p.name, sku: p.sku || undefined })),
    scrapedProducts.map(p => ({ 
      id: p.url || p.name,
      name: p.name, 
      sku: undefined 
    })),
    60
  );

  // Create links
  const linksToCreate = matches
    .filter(m => m.similarity >= 60)
    .map(m => {
      const scrapedProduct = scrapedProducts.find(p => (p.url || p.name) === m.competitorProductId);
      return {
        productId: m.productId,
        competitorProductId: m.competitorProductId,
        competitorProductUrl: scrapedProduct?.url || '',
        similarity: m.similarity,
      };
    })
    .filter(m => m.competitorProductUrl);

  result.productsMatched = await createCompetitorProductLinks(
    userId,
    storeId,
    competitorId,
    linksToCreate
  );

  // Increment heavy matching count
  await incrementHeavyMatchingCount(userId);

  return result;
}

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * Create a quick-start matching job
 */
export async function createQuickStartMatchingJob(
  userId: string,
  storeId: string,
  competitorId: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({
      user_id: userId,
      store_id: storeId,
      competitor_id: competitorId,
      job_type: 'quick_start_matching',
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating quick-start matching job:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Get pending matching jobs for a user
 */
export async function getPendingMatchingJobs(
  userId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  store_id: string;
  competitor_id: string;
  job_type: string;
  batch_number: number;
  scheduled_for: string;
}>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('id, store_id, competitor_id, job_type, batch_number, scheduled_for')
    .eq('user_id', userId)
    .in('job_type', ['matching', 'quick_start_matching'])
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching pending matching jobs:', error);
    return [];
  }

  return data || [];
}

/**
 * Update matching job status
 */
export async function updateMatchingJobStatus(
  jobId: string,
  status: 'in_progress' | 'completed' | 'failed' | 'deferred',
  result?: Partial<MatchingJobResult>
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
    updates.items_processed = result.productsMatched || 0;
    if (result.budgetExhausted) {
      updates.error_message = 'Budget exhausted';
    }
  }

  const { error } = await supabase
    .from('scrape_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('Error updating matching job status:', error);
  }
}

// ============================================================================
// COMPETITOR STORE VALIDATION
// ============================================================================

/**
 * Check if user can add a new competitor store
 */
export async function canAddCompetitorStore(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const rateLimit = await getRateLimitStatus(userId);

  if (!rateLimit.canAddCompetitorStore) {
    return {
      allowed: false,
      reason: `You can only add ${MAX_NEW_COMPETITOR_STORES_PER_DAY} new competitor store(s) per day. Try again tomorrow.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can add more URLs
 */
export async function canAddUrls(userId: string, count: number = 1): Promise<{
  allowed: boolean;
  remainingToday: number;
  reason?: string;
}> {
  const rateLimit = await getRateLimitStatus(userId);
  const remaining = MAX_URL_ADDITIONS_PER_DAY - rateLimit.urlsAdded;

  if (remaining < count) {
    return {
      allowed: false,
      remainingToday: Math.max(0, remaining),
      reason: `You can only add ${MAX_URL_ADDITIONS_PER_DAY} URLs per day. ${remaining} remaining today.`,
    };
  }

  return {
    allowed: true,
    remainingToday: remaining,
  };
}


