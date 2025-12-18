export type PlanId = "FREE" | "STARTER" | "PRO";
export type Plan = "free_demo" | "STARTER" | "pro" | "ultra";

export type PlanBadge = {
  emoji: string;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color?: string;
};

export const PLAN_BADGES: Record<string, PlanBadge> = {
  free_demo: {
    emoji: "🎯",
    label: "Free Demo",
    variant: "outline",
    color: "text-muted-foreground",
  },
  STARTER: {
    emoji: "🚀",
    label: "Starter",
    variant: "default",
  },
  PRO: {
    emoji: "⭐",
    label: "Pro",
    variant: "default",
  },
  SCALE: {
    emoji: "💎",
    label: "Scale",
    variant: "default",
  },
  pro: {
    emoji: "⭐",
    label: "Pro",
    variant: "default",
  },
  ultra: {
    emoji: "💎",
    label: "Scale",
    variant: "default",
  },
};

export type PlanLimits = {
  products: number;
  competitorsPerProduct: number;
  stores: number;
  syncsPerDay: number;
  autoPricing: boolean;
  bulkApply: boolean;
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: {
    products: 50,
    competitorsPerProduct: 2,
    stores: 1,
    syncsPerDay: 1,
    autoPricing: false,
    bulkApply: false,
  },
  PRO: {
    products: 200,
    competitorsPerProduct: 5,
    stores: 3,
    syncsPerDay: 2,
    autoPricing: true,
    bulkApply: true,
  },
  SCALE: {
    products: 400,
    competitorsPerProduct: 10,
    stores: 10,
    syncsPerDay: 4,
    autoPricing: true,
    bulkApply: true,
  },
  free_demo: {
    products: 50,
    competitorsPerProduct: 1,
    stores: 1,
    syncsPerDay: 0,
    autoPricing: false,
    bulkApply: false,
  },
  pro: {
    products: 200,
    competitorsPerProduct: 5,
    stores: 3,
    syncsPerDay: 2,
    autoPricing: true,
    bulkApply: true,
  },
  ultra: {
    products: 400,
    competitorsPerProduct: 10,
    stores: 10,
    syncsPerDay: 4,
    autoPricing: true,
    bulkApply: true,
  },
};

export const PLAN_COMPETITOR_LIMIT: Record<PlanId, number> = {
  FREE: 0,
  STARTER: 2,
  PRO: 5,
};

export function getCompetitorLimit(plan?: string | null): number {
  if (!plan) return PLAN_COMPETITOR_LIMIT.STARTER;
  
  const normalized = plan.toLowerCase().trim();
  
  // Map Plan values to PlanId
  if (normalized === "free_demo" || normalized === "demo" || normalized === "free") {
    return PLAN_COMPETITOR_LIMIT.FREE;
  }
  if (normalized === "starter" || normalized === "basic") {
    return PLAN_COMPETITOR_LIMIT.STARTER;
  }
  if (normalized === "pro" || normalized === "professional") {
    return PLAN_COMPETITOR_LIMIT.PRO;
  }
  if (normalized === "ultra" || normalized === "scale" || normalized === "enterprise") {
    return PLAN_COMPETITOR_LIMIT.PRO; // ultra maps to PRO limit
  }
  
  // Try direct uppercase match
  const upper = plan.toUpperCase() as PlanId;
  if (upper in PLAN_COMPETITOR_LIMIT) {
    return PLAN_COMPETITOR_LIMIT[upper];
  }
  
  return PLAN_COMPETITOR_LIMIT.STARTER;
}

/**
 * Check if a plan has access to AI chat feature
 * Typically available for PRO and ultra plans
 */
export function hasAiChatAccess(plan: Plan): boolean {
  const normalized = plan.toLowerCase().trim();
  return normalized === "pro" || normalized === "ultra" || normalized === "scale" || normalized === "enterprise";
}

/**
 * Normalize plan string from database to Plan type
 * Maps various plan strings to standard Plan values
 */
export function normalizePlan(plan?: string | null): Plan {
  if (!plan) return "free_demo";
  
  const normalized = plan.toLowerCase().trim();
  
  // Map to standard plan values
  if (normalized === "free_demo" || normalized === "demo" || normalized === "free") {
    return "free_demo";
  }
  if (normalized === "starter" || normalized === "basic") {
    return "STARTER";
  }
  if (normalized === "pro" || normalized === "professional") {
    return "pro";
  }
  if (normalized === "ultra" || normalized === "scale" || normalized === "enterprise") {
    return "ultra";
  }
  
  // Try direct match (case-sensitive)
  if (plan === "STARTER" || plan === "pro" || plan === "ultra" || plan === "free_demo") {
    return plan as Plan;
  }
  
  // Default fallback
  return "free_demo";
}

export type LimitCheckResult = {
  exceeded: boolean;
  limitType?: "products" | "competitors" | "stores";
  current: number;
  limit: number;
};

/**
 * Check if plan limits are exceeded
 */
export function isPlanLimitExceeded(
  plan: Plan,
  counts: {
    totalProducts?: number;
    competitorStores?: number;
    stores?: number;
  }
): LimitCheckResult {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free_demo;
  
  // Check products limit
  if (counts.totalProducts !== undefined) {
    if (counts.totalProducts >= limits.products) {
      return {
        exceeded: true,
        limitType: "products",
        current: counts.totalProducts,
        limit: limits.products,
      };
    }
  }
  
  // Check competitor stores limit (using competitorsPerProduct as a proxy)
  if (counts.competitorStores !== undefined) {
    // For now, use a reasonable default limit
    const competitorLimit = getCompetitorLimit(plan);
    if (counts.competitorStores >= competitorLimit) {
      return {
        exceeded: true,
        limitType: "competitors",
        current: counts.competitorStores,
        limit: competitorLimit,
      };
    }
  }
  
  // Check stores limit
  if (counts.stores !== undefined && limits.stores !== undefined) {
    if (counts.stores >= limits.stores) {
      return {
        exceeded: true,
        limitType: "stores",
        current: counts.stores,
        limit: limits.stores,
      };
    }
  }
  
  return {
    exceeded: false,
    current: 0,
    limit: 0,
  };
}
