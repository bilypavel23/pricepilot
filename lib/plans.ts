/**
 * Centralized Plan Configuration
 * 
 * This is the single source of truth for all plan limits.
 * All backend enforcement MUST import from this file.
 */

// ============================================================================
// PLAN TYPES
// ============================================================================

export type PlanName = 'free_demo' | 'STARTER' | 'PRO' | 'SCALE';

export interface PlanConfig {
  maxProducts: number;
  syncsPerDay: number;
  competitorsPerProduct: number;
  /** Display label for products (e.g., "400+" for Scale) */
  productsLabel: string;
  /** Display label for sync frequency */
  syncLabel: string;
  /** Short sync label for tables */
  syncLabelShort: string;
}

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export const PLANS: Record<PlanName, PlanConfig> = {
  free_demo: {
    maxProducts: 50,
    syncsPerDay: 0,
    competitorsPerProduct: 1,
    productsLabel: '50',
    syncLabel: 'No sync',
    syncLabelShort: '—',
  },
  STARTER: {
    maxProducts: 50,
    syncsPerDay: 1,
    competitorsPerProduct: 2,
    productsLabel: '50',
    syncLabel: '1× per day',
    syncLabelShort: '1×/day',
  },
  PRO: {
    maxProducts: 200,
    syncsPerDay: 2,
    competitorsPerProduct: 5,
    productsLabel: '200',
    syncLabel: '2× per day',
    syncLabelShort: '2×/day',
  },
  SCALE: {
    maxProducts: 400,
    syncsPerDay: 4,
    competitorsPerProduct: 10,
    productsLabel: '400+',
    syncLabel: '4× per day',
    syncLabelShort: '4×/day',
  },
};

// Aliases for case-insensitive matching
const PLAN_ALIASES: Record<string, PlanName> = {
  'free_demo': 'free_demo',
  'demo': 'free_demo',
  'free': 'free_demo',
  'starter': 'STARTER',
  'basic': 'STARTER',
  'pro': 'PRO',
  'professional': 'PRO',
  'scale': 'SCALE',
  'ultra': 'SCALE',
  'enterprise': 'SCALE',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a plan string to a valid PlanName
 */
export function normalizePlanName(plan: string | null | undefined): PlanName {
  if (!plan) return 'free_demo';
  
  const normalized = plan.toLowerCase().trim();
  
  // Check aliases
  if (normalized in PLAN_ALIASES) {
    return PLAN_ALIASES[normalized];
  }
  
  // Check exact match (case-insensitive)
  for (const [key, value] of Object.entries(PLAN_ALIASES)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  
  // Default fallback
  return 'free_demo';
}

/**
 * Get plan configuration for a plan name/string
 */
export function getPlanConfig(plan: string | null | undefined): PlanConfig {
  const planName = normalizePlanName(plan);
  return PLANS[planName];
}

/**
 * Get maximum products allowed for a plan
 */
export function getMaxProducts(plan: string | null | undefined): number {
  return getPlanConfig(plan).maxProducts;
}

/**
 * Get syncs per day allowed for a plan
 */
export function getSyncsPerDay(plan: string | null | undefined): number {
  return getPlanConfig(plan).syncsPerDay;
}

/**
 * Get competitors per product allowed for a plan
 */
export function getCompetitorsPerProduct(plan: string | null | undefined): number {
  return getPlanConfig(plan).competitorsPerProduct;
}

/**
 * Check if adding products would exceed plan limit
 */
export function wouldExceedProductLimit(
  currentCount: number,
  addCount: number,
  plan: string | null | undefined
): { exceeded: boolean; limit: number; canAdd: number } {
  const limit = getMaxProducts(plan);
  const wouldHave = currentCount + addCount;
  const exceeded = wouldHave > limit;
  const canAdd = Math.max(0, limit - currentCount);
  
  return { exceeded, limit, canAdd };
}

/**
 * Check if a sync run is allowed based on plan and today's count
 */
export function canRunSync(
  todaySyncCount: number,
  plan: string | null | undefined
): { allowed: boolean; limit: number; remaining: number; reason?: string } {
  const limit = getSyncsPerDay(plan);
  
  if (limit === 0) {
    return {
      allowed: false,
      limit: 0,
      remaining: 0,
      reason: 'Sync not available on this plan',
    };
  }
  
  const remaining = Math.max(0, limit - todaySyncCount);
  const allowed = todaySyncCount < limit;
  
  return {
    allowed,
    limit,
    remaining,
    reason: allowed ? undefined : `Sync limit reached (${limit}×/day)`,
  };
}

/**
 * Calculate hours between sync runs based on plan
 */
export function getHoursBetweenSyncs(plan: string | null | undefined): number {
  const syncsPerDay = getSyncsPerDay(plan);
  if (syncsPerDay <= 0) return 24 * 365; // effectively never
  return Math.floor(24 / syncsPerDay);
}


