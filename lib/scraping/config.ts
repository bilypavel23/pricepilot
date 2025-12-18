/**
 * Cost-Safe Competitor Price Scraping Configuration
 * 
 * This module defines all configuration constants for the scraping scheduler.
 * All values can be overridden via environment variables.
 * 
 * COST MATH:
 * - ScrapingBee charges ~$1.50 per 1,000 requests (configurable)
 * - Target budget: $30/user/month
 * - max_monthly_requests = floor(30 / 1.5 * 1000) = 20,000 requests
 * - max_daily_requests = floor(20,000 / 30) = 666 requests/day
 * 
 * With 200 products × 5 competitors = 1,000 URLs max per user
 * At 2x/day = 2,000 requests/day WITHOUT smart skipping
 * With smart skipping (50% stable URLs skip every other run) = ~1,500 requests/day
 * Still exceeds budget, so we MUST enforce hard caps.
 */

// ============================================================================
// PLAN LIMITS
// ============================================================================

/** Maximum products tracked per user on PRO plan */
export const PRO_PRODUCTS_LIMIT = parseInt(process.env.PRO_PRODUCTS_LIMIT || '200', 10);

/** Maximum competitor matches per product on PRO plan */
export const PRO_COMPETITORS_PER_PRODUCT_LIMIT = parseInt(process.env.PRO_COMPETITORS_PER_PRODUCT_LIMIT || '5', 10);

/** Number of tracking runs per day for PRO users */
export const PRO_TRACKING_RUNS_PER_DAY = parseInt(process.env.PRO_TRACKING_RUNS_PER_DAY || '2', 10);

/** Number of tracking runs per day for STARTER users */
export const STARTER_TRACKING_RUNS_PER_DAY = parseInt(process.env.STARTER_TRACKING_RUNS_PER_DAY || '1', 10);

/** Maximum products tracked per user on STARTER plan */
export const STARTER_PRODUCTS_LIMIT = parseInt(process.env.STARTER_PRODUCTS_LIMIT || '50', 10);

/** Maximum competitor matches per product on STARTER plan */
export const STARTER_COMPETITORS_PER_PRODUCT_LIMIT = parseInt(process.env.STARTER_COMPETITORS_PER_PRODUCT_LIMIT || '2', 10);

/** Maximum products tracked per user on SCALE plan */
export const SCALE_PRODUCTS_LIMIT = parseInt(process.env.SCALE_PRODUCTS_LIMIT || '400', 10);

/** Number of tracking runs per day for SCALE users */
export const SCALE_TRACKING_RUNS_PER_DAY = parseInt(process.env.SCALE_TRACKING_RUNS_PER_DAY || '4', 10);

// ============================================================================
// COST GUARDS
// ============================================================================

/** Cost per 1,000 ScrapingBee requests in USD */
export const SCRAPE_COST_PER_1000_REQ_USD = parseFloat(process.env.SCRAPE_COST_PER_1000_REQ_USD || '1.5');

/** Maximum monthly scraping budget per user in USD */
export const MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH = parseFloat(process.env.MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH || '30');

/**
 * Calculate maximum monthly requests based on budget
 * Formula: max_monthly_requests = floor(budget / cost_per_1000 * 1000)
 */
export const MAX_MONTHLY_REQUESTS_PER_USER = Math.floor(
  (MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH / SCRAPE_COST_PER_1000_REQ_USD) * 1000
);

/**
 * Calculate maximum daily requests based on monthly budget
 * Formula: max_daily_requests = floor(max_monthly / 30)
 */
export const MAX_DAILY_REQUESTS_PER_USER = Math.floor(MAX_MONTHLY_REQUESTS_PER_USER / 30);

// ============================================================================
// MATCHING JOB CONFIGURATION
// ============================================================================

/** Maximum heavy matching runs per day per user (initial product matching) */
export const HEAVY_MATCHING_RUNS_PER_DAY = parseInt(process.env.HEAVY_MATCHING_RUNS_PER_DAY || '1', 10);

/** Number of products to match immediately in "quick start" mode */
export const QUICK_START_MATCH_COUNT = parseInt(process.env.QUICK_START_MATCH_COUNT || '30', 10);

/** Batch size for processing products/URLs */
export const BATCH_SIZE = parseInt(process.env.SCRAPING_BATCH_SIZE || '25', 10);

/** Maximum new competitor stores that can be added per 24h */
export const MAX_NEW_COMPETITOR_STORES_PER_DAY = parseInt(process.env.MAX_NEW_COMPETITOR_STORES_PER_DAY || '1', 10);

/** Maximum URL additions per day per user */
export const MAX_URL_ADDITIONS_PER_DAY = parseInt(process.env.MAX_URL_ADDITIONS_PER_DAY || '50', 10);

// ============================================================================
// RETRY & BACKOFF CONFIGURATION
// ============================================================================

/** Maximum retries for failed scrape requests */
export const MAX_RETRIES = parseInt(process.env.SCRAPING_MAX_RETRIES || '2', 10);

/** Backoff delays in seconds for retries [first retry, second retry, ...] */
export const RETRY_BACKOFF_SECONDS = (process.env.SCRAPING_RETRY_BACKOFF_SECONDS || '60,300')
  .split(',')
  .map(s => parseInt(s.trim(), 10));

/** Default backoff when all retries exhausted (24 hours in seconds) */
export const EXHAUSTED_RETRY_BACKOFF_SECONDS = parseInt(process.env.SCRAPING_EXHAUSTED_RETRY_BACKOFF_SECONDS || '86400', 10);

// ============================================================================
// SMART SKIPPING CONFIGURATION
// ============================================================================

/**
 * Number of consecutive no-change checks before reducing frequency.
 * At 2x/day, 6 consecutive = 3 days of no change
 */
export const NO_CHANGE_STREAK_TO_SLOWDOWN = parseInt(process.env.NO_CHANGE_STREAK_TO_SLOWDOWN || '6', 10);

/**
 * Higher threshold for more aggressive skipping.
 * At 2x/day, 12 consecutive = 6 days of no change
 */
export const NO_CHANGE_STREAK_TO_HEAVY_SLOWDOWN = parseInt(process.env.NO_CHANGE_STREAK_TO_HEAVY_SLOWDOWN || '12', 10);

/**
 * Slowdown mode for stable URLs.
 * - "skipEveryOtherRun": Skip every other tracking run (effective 1x/day for PRO)
 * - "skipTwoRunsThenCheck": Skip 2 runs, then check (effective ~1 check per 1.5 days)
 */
export type SlowdownMode = 'skipEveryOtherRun' | 'skipTwoRunsThenCheck' | 'normal';

/** Hours to skip for first-level slowdown (skip every other run) */
export const SLOWDOWN_SKIP_HOURS = parseInt(process.env.SLOWDOWN_SKIP_HOURS || '12', 10);

/** Hours to skip for heavy slowdown (skip 2 runs then check) */
export const HEAVY_SLOWDOWN_SKIP_HOURS = parseInt(process.env.HEAVY_SLOWDOWN_SKIP_HOURS || '36', 10);

// ============================================================================
// SCRAPING API CONFIGURATION
// ============================================================================

/** ScrapingBee API base URL */
export const SCRAPING_API_BASE_URL = process.env.SCRAPING_API_BASE_URL || 'https://app.scrapingbee.com/api/v1';

/** ScrapingBee API key */
export const SCRAPING_API_KEY = process.env.SCRAPING_API_KEY || '';

/** Whether to render JavaScript (more expensive) */
export const SCRAPING_RENDER_JS = process.env.SCRAPING_RENDER_JS === 'true';

/** Request timeout in milliseconds */
export const SCRAPING_TIMEOUT_MS = parseInt(process.env.SCRAPING_TIMEOUT_MS || '30000', 10);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tracking runs per day based on plan
 */
export function getTrackingRunsPerDay(plan: string | null | undefined): number {
  const normalized = (plan ?? '').toLowerCase();
  if (normalized === 'pro' || normalized === 'ultra' || normalized === 'scale') {
    return PRO_TRACKING_RUNS_PER_DAY;
  }
  if (normalized === 'starter') {
    return STARTER_TRACKING_RUNS_PER_DAY;
  }
  return 0; // free_demo gets no tracking
}

/**
 * Get products limit based on plan
 */
export function getProductsLimit(plan: string | null | undefined): number {
  const normalized = (plan ?? '').toLowerCase();
  if (normalized === 'pro' || normalized === 'ultra' || normalized === 'scale') {
    return PRO_PRODUCTS_LIMIT;
  }
  if (normalized === 'starter') {
    return STARTER_PRODUCTS_LIMIT;
  }
  return 50; // free_demo
}

/**
 * Get competitors per product limit based on plan
 */
export function getCompetitorsPerProductLimit(plan: string | null | undefined): number {
  const normalized = (plan ?? '').toLowerCase();
  if (normalized === 'pro' || normalized === 'ultra' || normalized === 'scale') {
    return PRO_COMPETITORS_PER_PRODUCT_LIMIT;
  }
  if (normalized === 'starter') {
    return STARTER_COMPETITORS_PER_PRODUCT_LIMIT;
  }
  return 1; // free_demo
}

/**
 * Calculate hours between sync runs based on plan
 */
export function getHoursBetweenSync(plan: string | null | undefined): number {
  const runsPerDay = getTrackingRunsPerDay(plan);
  if (runsPerDay <= 0) return 24 * 365; // effectively never
  return Math.floor(24 / runsPerDay);
}

/**
 * Calculate the next allowed check time based on no-change streak
 */
export function calculateNextAllowedCheck(
  noChangeStreak: number,
  now: Date = new Date()
): Date | null {
  if (noChangeStreak >= NO_CHANGE_STREAK_TO_HEAVY_SLOWDOWN) {
    // Heavy slowdown: skip ~36 hours
    return new Date(now.getTime() + HEAVY_SLOWDOWN_SKIP_HOURS * 60 * 60 * 1000);
  }
  if (noChangeStreak >= NO_CHANGE_STREAK_TO_SLOWDOWN) {
    // Normal slowdown: skip ~12 hours (every other run for PRO)
    return new Date(now.getTime() + SLOWDOWN_SKIP_HOURS * 60 * 60 * 1000);
  }
  // No slowdown needed
  return null;
}

/**
 * Calculate retry backoff time
 */
export function calculateRetryBackoff(errorStreak: number, now: Date = new Date()): Date {
  if (errorStreak <= 0) {
    return now;
  }
  if (errorStreak > MAX_RETRIES) {
    // All retries exhausted, wait 24 hours
    return new Date(now.getTime() + EXHAUSTED_RETRY_BACKOFF_SECONDS * 1000);
  }
  // Use configured backoff for this retry attempt
  const backoffIndex = Math.min(errorStreak - 1, RETRY_BACKOFF_SECONDS.length - 1);
  const backoffSeconds = RETRY_BACKOFF_SECONDS[backoffIndex] || 60;
  return new Date(now.getTime() + backoffSeconds * 1000);
}

/**
 * Check if a plan has tracking enabled
 */
export function hasTrackingEnabled(plan: string | null | undefined): boolean {
  return getTrackingRunsPerDay(plan) > 0;
}

