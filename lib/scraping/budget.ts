/**
 * Scrape Budget Management
 * 
 * This module provides the scrapeWithBudget wrapper that:
 * 1. Checks user's daily/monthly budget before making requests
 * 2. Increments counters after successful requests
 * 3. Returns deferred status when budget is exceeded
 * 4. Handles budget resets for new days/months
 */

import { createClient } from "@/lib/supabase/server";
import {
  MAX_DAILY_REQUESTS_PER_USER,
  MAX_MONTHLY_REQUESTS_PER_USER,
  SCRAPING_API_BASE_URL,
  SCRAPING_API_KEY,
  SCRAPING_RENDER_JS,
  SCRAPING_TIMEOUT_MS,
} from "./config";

// ============================================================================
// TYPES
// ============================================================================

export interface ScrapeBudgetStatus {
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  canScrape: boolean;
}

export interface ScrapeResult<T = string> {
  success: boolean;
  data?: T;
  deferred?: boolean;
  error?: string;
  budgetExceeded?: boolean;
  requestCost?: number;
}

export interface ScrapeOptions {
  renderJs?: boolean;
  timeout?: number;
  /** Number of requests this call will consume (default: 1) */
  requestCost?: number;
  /** Skip budget check (for internal/admin use only) */
  skipBudgetCheck?: boolean;
}

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * Get or create user's scrape budget record
 */
export async function getOrCreateScrapeBudget(userId: string): Promise<ScrapeBudgetStatus> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  // Try to get existing budget
  const { data: existing } = await supabase
    .from('user_scrape_budget')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Check if we need to reset daily counter
    let dailyUsed = existing.requests_used_today;
    let monthlyUsed = existing.requests_used_month;
    const needsDailyReset = existing.requests_today_date !== today;
    const needsMonthlyReset = existing.period_start < monthStart;

    if (needsDailyReset || needsMonthlyReset) {
      // Reset counters
      const updates: any = { updated_at: new Date().toISOString() };
      
      if (needsDailyReset) {
        updates.requests_used_today = 0;
        updates.requests_today_date = today;
        dailyUsed = 0;
      }
      
      if (needsMonthlyReset) {
        updates.requests_used_month = 0;
        updates.period_start = monthStart;
        monthlyUsed = 0;
      }

      await supabase
        .from('user_scrape_budget')
        .update(updates)
        .eq('user_id', userId);
    }

    return {
      dailyUsed,
      dailyLimit: MAX_DAILY_REQUESTS_PER_USER,
      dailyRemaining: Math.max(0, MAX_DAILY_REQUESTS_PER_USER - dailyUsed),
      monthlyUsed,
      monthlyLimit: MAX_MONTHLY_REQUESTS_PER_USER,
      monthlyRemaining: Math.max(0, MAX_MONTHLY_REQUESTS_PER_USER - monthlyUsed),
      canScrape: dailyUsed < MAX_DAILY_REQUESTS_PER_USER && monthlyUsed < MAX_MONTHLY_REQUESTS_PER_USER,
    };
  }

  // Create new budget record
  const { error: insertError } = await supabase
    .from('user_scrape_budget')
    .insert({
      user_id: userId,
      period_start: monthStart,
      requests_used_month: 0,
      requests_today_date: today,
      requests_used_today: 0,
    });

  if (insertError) {
    console.error('Failed to create scrape budget:', insertError);
  }

  return {
    dailyUsed: 0,
    dailyLimit: MAX_DAILY_REQUESTS_PER_USER,
    dailyRemaining: MAX_DAILY_REQUESTS_PER_USER,
    monthlyUsed: 0,
    monthlyLimit: MAX_MONTHLY_REQUESTS_PER_USER,
    monthlyRemaining: MAX_MONTHLY_REQUESTS_PER_USER,
    canScrape: true,
  };
}

/**
 * Increment user's scrape budget usage
 */
export async function incrementScrapeBudget(
  userId: string,
  requestCount: number = 1
): Promise<ScrapeBudgetStatus> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  // Ensure record exists and get current values
  const budget = await getOrCreateScrapeBudget(userId);

  // Increment counters
  const newDailyUsed = budget.dailyUsed + requestCount;
  const newMonthlyUsed = budget.monthlyUsed + requestCount;

  const { error } = await supabase
    .from('user_scrape_budget')
    .update({
      requests_used_today: newDailyUsed,
      requests_used_month: newMonthlyUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to increment scrape budget:', error);
  }

  return {
    dailyUsed: newDailyUsed,
    dailyLimit: MAX_DAILY_REQUESTS_PER_USER,
    dailyRemaining: Math.max(0, MAX_DAILY_REQUESTS_PER_USER - newDailyUsed),
    monthlyUsed: newMonthlyUsed,
    monthlyLimit: MAX_MONTHLY_REQUESTS_PER_USER,
    monthlyRemaining: Math.max(0, MAX_MONTHLY_REQUESTS_PER_USER - newMonthlyUsed),
    canScrape: newDailyUsed < MAX_DAILY_REQUESTS_PER_USER && newMonthlyUsed < MAX_MONTHLY_REQUESTS_PER_USER,
  };
}

/**
 * Check if user can make a scrape request
 */
export async function canUserScrape(userId: string, requestCount: number = 1): Promise<boolean> {
  const budget = await getOrCreateScrapeBudget(userId);
  return (
    budget.dailyUsed + requestCount <= MAX_DAILY_REQUESTS_PER_USER &&
    budget.monthlyUsed + requestCount <= MAX_MONTHLY_REQUESTS_PER_USER
  );
}

// ============================================================================
// SCRAPE WITH BUDGET WRAPPER
// ============================================================================

/**
 * Main scraping function that enforces budget limits.
 * 
 * This is the ONLY function that should be used to make ScrapingBee API calls.
 * It automatically:
 * - Checks budget before making requests
 * - Increments counters after successful requests
 * - Returns deferred status when budget is exceeded
 * 
 * @param userId - The user making the request
 * @param url - The URL to scrape
 * @param options - Scraping options
 * @returns ScrapeResult with HTML content or deferred/error status
 */
export async function scrapeWithBudget(
  userId: string,
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult<string>> {
  const {
    renderJs = SCRAPING_RENDER_JS,
    timeout = SCRAPING_TIMEOUT_MS,
    requestCost = 1,
    skipBudgetCheck = false,
  } = options;

  // Check API configuration
  if (!SCRAPING_API_KEY || !SCRAPING_API_BASE_URL) {
    console.warn('Missing SCRAPING_API_KEY or SCRAPING_API_BASE_URL');
    return {
      success: false,
      error: 'Scraping API not configured',
    };
  }

  // Check budget (unless skipped)
  if (!skipBudgetCheck) {
    const canProceed = await canUserScrape(userId, requestCost);
    if (!canProceed) {
      const budget = await getOrCreateScrapeBudget(userId);
      return {
        success: false,
        deferred: true,
        budgetExceeded: true,
        error: `Budget exceeded. Daily: ${budget.dailyUsed}/${budget.dailyLimit}, Monthly: ${budget.monthlyUsed}/${budget.monthlyLimit}`,
      };
    }
  }

  // Build API URL
  const apiUrl = new URL(SCRAPING_API_BASE_URL);
  apiUrl.searchParams.set('api_key', SCRAPING_API_KEY);
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('render_js', renderJs ? 'true' : 'false');

  try {
    // Make the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Don't count failed requests against budget
      return {
        success: false,
        error: `ScrapingBee returned status ${response.status}`,
      };
    }

    const html = await response.text();

    // Increment budget after successful request
    if (!skipBudgetCheck) {
      await incrementScrapeBudget(userId, requestCost);
    }

    return {
      success: true,
      data: html,
      requestCost,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out after ${timeout}ms`,
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown scraping error',
    };
  }
}

/**
 * Batch scrape multiple URLs with budget enforcement.
 * Stops when budget is exceeded and returns partial results.
 * 
 * @param userId - The user making the requests
 * @param urls - Array of URLs to scrape
 * @param options - Scraping options
 * @returns Array of results (some may be deferred)
 */
export async function batchScrapeWithBudget(
  userId: string,
  urls: string[],
  options: ScrapeOptions = {}
): Promise<{
  results: Array<{ url: string; result: ScrapeResult<string> }>;
  completed: number;
  deferred: number;
  budgetExhausted: boolean;
}> {
  const results: Array<{ url: string; result: ScrapeResult<string> }> = [];
  let completed = 0;
  let deferred = 0;
  let budgetExhausted = false;

  for (const url of urls) {
    const result = await scrapeWithBudget(userId, url, options);
    results.push({ url, result });

    if (result.success) {
      completed++;
    } else if (result.deferred) {
      deferred++;
      budgetExhausted = true;
      // Mark remaining URLs as deferred without making requests
      for (const remainingUrl of urls.slice(results.length)) {
        results.push({
          url: remainingUrl,
          result: {
            success: false,
            deferred: true,
            budgetExceeded: true,
            error: 'Budget exhausted, request deferred',
          },
        });
        deferred++;
      }
      break;
    }
  }

  return {
    results,
    completed,
    deferred,
    budgetExhausted,
  };
}

// ============================================================================
// LOGGING (Optional - for debugging)
// ============================================================================

/**
 * Log a scrape attempt for debugging purposes.
 * This is optional and can be enabled via environment variable.
 */
export async function logScrapeAttempt(
  userId: string,
  url: string,
  result: ScrapeResult<any>,
  metadata?: Record<string, any>
): Promise<void> {
  if (process.env.ENABLE_SCRAPE_LOGGING !== 'true') {
    return;
  }

  // For now, just console log. Could be extended to write to a table.
  console.log('[Scrape Log]', {
    timestamp: new Date().toISOString(),
    userId,
    url,
    success: result.success,
    deferred: result.deferred,
    error: result.error,
    requestCost: result.requestCost,
    ...metadata,
  });
}

