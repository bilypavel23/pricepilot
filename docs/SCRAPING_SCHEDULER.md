# Cost-Safe Competitor Price Scraping Scheduler

This document describes the implementation of the cost-safe competitor price scraping system for PricePilot.

## Overview

The scraping scheduler provides automated competitor price tracking with built-in cost controls to ensure scraping costs stay within budget (~$30/user/month).

## Key Features

### 1. Budget Enforcement
- **Daily limit**: ~666 requests/day per user
- **Monthly limit**: ~20,000 requests/month per user
- Based on ScrapingBee pricing of $1.50 per 1,000 requests
- All limits are configurable via environment variables

### 2. Plan-Based Tracking Frequency
| Plan | Products | Competitors/Product | Syncs/Day |
|------|----------|---------------------|-----------|
| Free Demo | 50 | 1 | 0 |
| Starter | 100 | 2 | 1 |
| **Pro** | **200** | **5** | **2** |
| Scale | 500 | 10 | 4 |

### 3. Smart Skipping
Reduces tracking frequency for stable URLs:
- After **6 consecutive** unchanged checks → skip every other run (~1x/day for PRO)
- After **12 consecutive** unchanged checks → more aggressive skipping (~1 check/1.5 days)
- Price change resets streak to 0 and returns to normal frequency

### 4. Retry Backoff
Handles failed scrapes gracefully:
- First retry: 60 seconds
- Second retry: 300 seconds (5 minutes)
- After all retries exhausted: 24 hours
- URLs marked as "needs attention" after multiple failures

### 5. Quick-Start Matching
When adding a new competitor:
1. Immediately match top 30 products
2. Queue remaining products for batch processing
3. Batches run 5 minutes apart to spread load

### 6. Rate Limiting
- Max 1 heavy matching run per day per user
- Max 1 new competitor store per day
- Max 50 URL additions per day

## Configuration

All configuration is in `lib/scraping/config.ts` and can be overridden via environment variables:

```env
# Plan limits
PRO_PRODUCTS_LIMIT=200
PRO_COMPETITORS_PER_PRODUCT_LIMIT=5
PRO_TRACKING_RUNS_PER_DAY=2
STARTER_TRACKING_RUNS_PER_DAY=1

# Cost guards
SCRAPE_COST_PER_1000_REQ_USD=1.5
MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH=30

# Matching
HEAVY_MATCHING_RUNS_PER_DAY=1
QUICK_START_MATCH_COUNT=30
SCRAPING_BATCH_SIZE=25

# Retry
SCRAPING_MAX_RETRIES=2
SCRAPING_RETRY_BACKOFF_SECONDS=60,300

# Smart skipping
NO_CHANGE_STREAK_TO_SLOWDOWN=6
NO_CHANGE_STREAK_TO_HEAVY_SLOWDOWN=12
SLOWDOWN_SKIP_HOURS=12
HEAVY_SLOWDOWN_SKIP_HOURS=36

# ScrapingBee
SCRAPING_API_BASE_URL=https://app.scrapingbee.com/api/v1
SCRAPING_API_KEY=your_api_key
```

## Database Schema

New tables created by migration `create_scraping_budget_tables.sql`:

### competitor_product_links
Stores individual competitor product URLs with tracking metadata:
- `last_price`, `last_checked_at`, `last_changed_at`
- `no_change_streak` - for smart skipping
- `error_streak` - for retry backoff
- `next_allowed_check_at` - scheduling
- `is_active`, `needs_attention` - status flags

### user_scrape_budget
Tracks scraping request usage:
- `requests_used_today`, `requests_used_month`
- Auto-resets daily and monthly

### scrape_jobs
Queue for batch processing:
- Job types: `tracking`, `matching`, `quick_start_matching`
- Status: `pending`, `in_progress`, `completed`, `failed`, `deferred`

### user_matching_rate_limit
Enforces daily limits:
- `heavy_matching_count`
- `competitor_stores_added`
- `urls_added`

### competitor_price_history
Historical price data for analytics.

## API Endpoints

### POST /api/scraping/tracking
Triggers a price tracking job.

### GET /api/scraping/tracking
Returns tracking job status and budget info.

### POST /api/scraping/matching
Triggers product matching for a competitor.
- `competitorId` (required)
- `quickStart` (optional, default: true)

### GET /api/scraping/matching
Returns matching status and rate limits.

### GET /api/scraping/budget
Returns detailed budget status.

## Usage Examples

### Running a tracking job
```typescript
import { runTrackingJob } from '@/lib/scraping';

const result = await runTrackingJob(userId, storeId, plan);
console.log(`Processed: ${result.linksProcessed}, Changes: ${result.priceChanges}`);
```

### Checking budget before scraping
```typescript
import { canUserScrape, scrapeWithBudget } from '@/lib/scraping';

if (await canUserScrape(userId)) {
  const result = await scrapeWithBudget(userId, url);
  if (result.deferred) {
    console.log('Budget exceeded, request deferred');
  }
}
```

### Quick-start matching
```typescript
import { runQuickStartMatching } from '@/lib/scraping';

const result = await runQuickStartMatching(userId, storeId, competitorId, competitorUrl);
console.log(`Matched: ${result.productsMatched}, Queued: ${result.productsDeferred}`);
```

## Cost Math

With default settings:
- Monthly budget: $30
- Cost per 1,000 requests: $1.50
- Max monthly requests: 20,000
- Max daily requests: 666

PRO user with 200 products × 5 competitors = 1,000 URLs:
- Without smart skipping: 2,000 requests/day (exceeds budget)
- With ~50% stable URLs skipping: ~1,500 requests/day
- Hard cap ensures we never exceed 666/day

## Cron Jobs

Set up cron jobs to run tracking at configured times:

```bash
# Example: Run tracking at 06:00 and 18:00 UTC
0 6,18 * * * curl -X POST https://your-app/api/scraping/tracking
```

Or use a queue system like BullMQ/Inngest for more sophisticated scheduling.

## Migration Notes

### Changed from 4x to 2x daily for PRO
- Updated `lib/plan.ts`: `syncsPerDay: 4` → `syncsPerDay: 2`
- Updated `lib/planLimits.ts`: same change
- Updated `lib/competitors/syncSettings.ts`: PRO default times changed from 4 to 2
- Updated sync route: `hoursBetweenSync` for PRO changed from 6 to 12 hours

