export type Plan = "free_demo" | "STARTER" | "PRO" | "SCALE";

/**
 * Normalizes a plan value from the database to a valid Plan type.
 * Handles variations like "pro" -> "PRO", "ultra" -> "SCALE", etc.
 */
export function normalizePlan(plan: string | null | undefined): Plan {
  if (!plan) return "free_demo";
  
  const normalized = plan.toUpperCase();
  
  // Handle exact matches and common variations
  if (normalized === "PRO" || normalized === "PROFESSIONAL") return "PRO";
  if (normalized === "SCALE" || normalized === "ULTRA" || normalized === "ENTERPRISE") return "SCALE";
  if (normalized === "STARTER" || normalized === "BASIC") return "STARTER";
  if (normalized === "FREE_DEMO" || normalized === "DEMO" || normalized === "FREE") return "free_demo";
  
  // Default to free_demo for unknown plans
  return "free_demo";
}

/**
 * Validates if a plan is a valid Plan type
 */
export function isValidPlan(plan: string | null | undefined): plan is Plan {
  if (!plan) return false;
  return plan === "free_demo" || plan === "STARTER" || plan === "PRO" || plan === "SCALE";
}

export const PLAN_LIMITS = {
  free_demo: {
    products: 10,
    competitorsPerProduct: 1,
    stores: 1,
    syncsPerDay: 1,
    aiChat: false,
    alerts: "Basic",
    support: "Email",
  },
  STARTER: {
    products: 100,
    competitorsPerProduct: 2,
    stores: 3,
    syncsPerDay: 1,
    aiChat: false,
    alerts: "Basic",
    support: "Email",
  },
  PRO: {
    products: 500,
    competitorsPerProduct: 3,
    stores: 5,
    syncsPerDay: 4,
    aiChat: true,
    alerts: "Priority",
    support: "Priority",
  },
  SCALE: {
    products: 1000,
    competitorsPerProduct: 5,
    stores: 10,
    syncsPerDay: 6,
    aiChat: true,
    alerts: "Fast / Premium",
    support: "Dedicated",
  },
};

export const PLAN_BADGES = {
  free_demo: {
    emoji: "🆓",
    label: "FREE DEMO",
    variant: "outline" as const,
    color: "text-slate-600 dark:text-slate-400",
  },
  STARTER: {
    emoji: "💠",
    label: "STARTER",
    variant: "outline" as const,
    color: "text-slate-600 dark:text-slate-400",
  },
  PRO: {
    emoji: "⭐",
    label: "PRO",
    variant: "default" as const,
    color: "text-blue-600 dark:text-blue-400",
  },
  SCALE: {
    emoji: "🚀",
    label: "SCALE",
    variant: "default" as const,
    color: "text-emerald-600 dark:text-emerald-400",
  },
};

export interface PlanStats {
  totalProducts: number;
  competitorStores: number;
  competitorsPerProduct?: number;
}

export function isPlanLimitExceeded(
  plan: Plan | null | undefined,
  stats: PlanStats
): {
  exceeded: boolean;
  limitType?: "products" | "stores" | "competitorsPerProduct";
  current: number;
  limit: number;
} {
  const normalizedPlan = plan && isValidPlan(plan) ? plan : "free_demo";
  const limits = PLAN_LIMITS[normalizedPlan];

  // Check products limit
  if (stats.totalProducts >= limits.products) {
    return {
      exceeded: true,
      limitType: "products",
      current: stats.totalProducts,
      limit: limits.products,
    };
  }

  // Check competitor stores limit
  if (stats.competitorStores >= limits.stores) {
    return {
      exceeded: true,
      limitType: "stores",
      current: stats.competitorStores,
      limit: limits.stores,
    };
  }

  // Check competitors per product limit
  if (
    stats.competitorsPerProduct !== undefined &&
    stats.competitorsPerProduct >= limits.competitorsPerProduct
  ) {
    return {
      exceeded: true,
      limitType: "competitorsPerProduct",
      current: stats.competitorsPerProduct,
      limit: limits.competitorsPerProduct,
    };
  }

  return { exceeded: false, current: 0, limit: 0 };
}

export function canAddProduct(currentCount: number, plan: Plan | null | undefined): boolean {
  const normalizedPlan = plan && isValidPlan(plan) ? plan : "free_demo";
  return currentCount < PLAN_LIMITS[normalizedPlan].products;
}

export function canAddCompetitorStore(currentCount: number, plan: Plan | null | undefined): boolean {
  const normalizedPlan = plan && isValidPlan(plan) ? plan : "free_demo";
  return currentCount < PLAN_LIMITS[normalizedPlan].stores;
}

export function hasAiChatAccess(plan: Plan | null | undefined): boolean {
  const normalizedPlan = plan && isValidPlan(plan) ? plan : "free_demo";
  return PLAN_LIMITS[normalizedPlan].aiChat;
}

export function canSync(plan: Plan | null | undefined, lastSyncTime?: Date): boolean {
  const normalizedPlan = plan && isValidPlan(plan) ? plan : "free_demo";
  const limits = PLAN_LIMITS[normalizedPlan];
  if (!lastSyncTime) return true;
  
  const hoursSinceLastSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
  const minHoursBetweenSyncs = 24 / limits.syncsPerDay;
  
  return hoursSinceLastSync >= minHoursBetweenSyncs;
}

// Legacy function for backward compatibility
export const planLimits: Record<
  Plan,
  { maxProducts: number; competitorTracking: boolean; reports: boolean; support: string }
> = {
  free_demo: {
    maxProducts: PLAN_LIMITS.free_demo.products,
    competitorTracking: true,
    reports: true,
    support: PLAN_LIMITS.free_demo.support,
  },
  STARTER: {
    maxProducts: PLAN_LIMITS.STARTER.products,
    competitorTracking: true,
    reports: true,
    support: PLAN_LIMITS.STARTER.support,
  },
  PRO: {
    maxProducts: PLAN_LIMITS.PRO.products,
    competitorTracking: true,
    reports: true,
    support: PLAN_LIMITS.PRO.support,
  },
  SCALE: {
    maxProducts: PLAN_LIMITS.SCALE.products,
    competitorTracking: true,
    reports: true,
    support: PLAN_LIMITS.SCALE.support,
  },
};
