/**
 * Cost-Safe Competitor Price Scraping Module
 * 
 * This module provides a complete solution for scraping competitor prices
 * with built-in cost controls and smart scheduling.
 * 
 * Main features:
 * - Budget enforcement: caps daily/monthly requests per user
 * - Smart skipping: reduces frequency for stable prices
 * - Retry backoff: handles errors gracefully
 * - Quick-start matching: immediate results for new competitors
 * - Batch processing: spreads load over time
 * 
 * Usage:
 * ```typescript
 * import { 
 *   scrapeWithBudget,
 *   runTrackingJob,
 *   runQuickStartMatching,
 * } from '@/lib/scraping';
 * ```
 */

// Configuration
export * from './config';

// Budget management
export {
  getOrCreateScrapeBudget,
  incrementScrapeBudget,
  canUserScrape,
  scrapeWithBudget,
  batchScrapeWithBudget,
  logScrapeAttempt,
  type ScrapeBudgetStatus,
  type ScrapeResult,
  type ScrapeOptions,
} from './budget';

// Price tracking
export {
  getLinksForTracking,
  countTrackableLinks,
  extractPriceFromHtml,
  updateLinkAfterTracking,
  runTrackingJob,
  canRunTracking,
  createTrackingJob,
  updateTrackingJobStatus,
  type CompetitorProductLink,
  type TrackingResult,
  type TrackingJobResult,
} from './tracking';

// Product matching
export {
  getRateLimitStatus,
  incrementHeavyMatchingCount,
  incrementCompetitorStoresAdded,
  incrementUrlsAdded,
  getProductsForMatching,
  countProductsForStore,
  createCompetitorProductLinks,
  runQuickStartMatching,
  queueBatchMatching,
  runBatchMatching,
  createQuickStartMatchingJob,
  getPendingMatchingJobs,
  updateMatchingJobStatus,
  canAddCompetitorStore,
  canAddUrls,
  type MatchingJobResult,
  type RateLimitStatus,
} from './matching';

