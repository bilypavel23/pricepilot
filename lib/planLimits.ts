export type Plan = "free_demo" | "STARTER" | "PRO" | "SCALE";

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
  plan: Plan,
  stats: PlanStats
): {
  exceeded: boolean;
  limitType?: "products" | "stores" | "competitorsPerProduct";
  current: number;
  limit: number;
} {
  const limits = PLAN_LIMITS[plan];

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

export function canAddProduct(currentCount: number, plan: Plan): boolean {
  return currentCount < PLAN_LIMITS[plan].products;
}

/**
 * Check if a limit has been reached for a given plan and current count.
 * @param plan - Plan type
 * @param currentCount - Current count of items (e.g., products)
 * @returns True if the limit has been reached or exceeded
 */
export function isLimitReached(plan: Plan, currentCount: number): boolean {
  return currentCount >= PLAN_LIMITS[plan].products;
}

export function canAddCompetitorStore(currentCount: number, plan: Plan): boolean {
  return currentCount < PLAN_LIMITS[plan].stores;
}

export function hasAiChatAccess(plan: Plan): boolean {
  return PLAN_LIMITS[plan].aiChat;
}

export function canSync(plan: Plan, lastSyncTime?: Date): boolean {
  const limits = PLAN_LIMITS[plan];
  if (!lastSyncTime) return true;
  
  const hoursSinceLastSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
  const minHoursBetweenSyncs = 24 / limits.syncsPerDay;
  
  return hoursSinceLastSync >= minHoursBetweenSyncs;
}

/**
 * Normalize unknown plan input to a valid Plan type.
 * @param input - Plan value (string, null, undefined, etc.)
 * @returns Normalized Plan value
 */
export function normalizePlan(input: unknown): Plan {
  const raw = String(input ?? "").toLowerCase().trim();

  // Common aliases
  if (raw === "basic" || raw === "trial") return "STARTER";
  if (raw === "premium") return "PRO";
  if (raw === "enterprise") return "SCALE";

  // Direct matches (case-insensitive)
  if (raw === "free_demo" || raw === "demo" || raw === "free") return "free_demo";
  if (raw === "starter") return "STARTER";
  if (raw === "pro" || raw === "professional") return "PRO";
  if (raw === "scale" || raw === "ultra") return "SCALE";

  // Uppercase matches (for existing data)
  const upper = String(input ?? "").toUpperCase().trim();
  if (upper === "FREE_DEMO" || upper === "DEMO" || upper === "FREE") return "free_demo";
  if (upper === "STARTER") return "STARTER";
  if (upper === "PRO" || upper === "PROFESSIONAL") return "PRO";
  if (upper === "SCALE" || upper === "ULTRA" || upper === "ENTERPRISE") return "SCALE";

  // Fallback to STARTER (safest default)
  return "STARTER";
}

/**
 * Get the maximum number of products allowed for a given plan.
 * @param plan - Plan type
 * @returns Maximum number of products
 */
export function getProductLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].products;
}

/**
 * Get the maximum number of competitors allowed per product for a given plan.
 * @param plan - Plan name (case-insensitive, will be normalized)
 * @returns Maximum competitors per product
 */
export function getCompetitorLimit(plan?: string | null): number {
  if (!plan) {
    return PLAN_LIMITS.STARTER.competitorsPerProduct; // Default to STARTER
  }

  const normalized = plan.trim();

  // Direct match for PLAN_LIMITS keys (case-sensitive)
  if (normalized === "free_demo") {
    return PLAN_LIMITS.free_demo.competitorsPerProduct;
  }
  if (normalized === "STARTER") {
    return PLAN_LIMITS.STARTER.competitorsPerProduct;
  }
  if (normalized === "PRO") {
    return PLAN_LIMITS.PRO.competitorsPerProduct;
  }
  if (normalized === "SCALE") {
    return PLAN_LIMITS.SCALE.competitorsPerProduct;
  }

  // Case-insensitive fallback
  const lower = normalized.toLowerCase();
  if (lower === "free_demo" || lower === "demo" || lower === "free") {
    return PLAN_LIMITS.free_demo.competitorsPerProduct;
  }
  if (lower === "starter" || lower === "basic") {
    return PLAN_LIMITS.STARTER.competitorsPerProduct;
  }
  if (lower === "pro" || lower === "professional") {
    return PLAN_LIMITS.PRO.competitorsPerProduct;
  }
  if (lower === "scale" || lower === "ultra" || lower === "enterprise") {
    return PLAN_LIMITS.SCALE.competitorsPerProduct;
  }

  // Default fallback to STARTER
  return PLAN_LIMITS.STARTER.competitorsPerProduct;
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

// Export product limits in lowercase format for marketing pages
export const PLAN_PRODUCT_LIMITS = {
  starter: PLAN_LIMITS.STARTER.products,
  pro: PLAN_LIMITS.PRO.products,
  scale: PLAN_LIMITS.SCALE.products,
} as const;

