export type Plan = "free_demo" | "STARTER" | "PRO" | "SCALE" | "pro" | "ultra";

// Map database plan values to normalized Plan type
export function normalizePlan(plan: string | null | undefined): Plan {
  if (!plan) return "free_demo";
  const normalized = plan.toLowerCase();
  if (normalized === "pro") return "PRO";
  if (normalized === "ultra") return "SCALE";
  if (["free_demo", "starter", "pro", "scale"].includes(normalized)) {
    return normalized.toUpperCase() === "STARTER" ? "STARTER" : 
           normalized.toUpperCase() === "PRO" ? "PRO" :
           normalized.toUpperCase() === "SCALE" ? "SCALE" : "free_demo";
  }
  return "free_demo";
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
  // Aliases for lowercase variants from DB
  pro: {
    products: 500,
    competitorsPerProduct: 3,
    stores: 5,
    syncsPerDay: 4,
    aiChat: true,
    alerts: "Priority",
    support: "Priority",
  },
  ultra: {
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
  // Aliases for lowercase variants
  pro: {
    emoji: "⭐",
    label: "PRO",
    variant: "default" as const,
    color: "text-blue-600 dark:text-blue-400",
  },
  ultra: {
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
  if (!plan || !PLAN_LIMITS[plan]) {
    return { exceeded: true, current: 0, limit: 0 };
  }
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

export function canAddProduct(currentCount: number, plan: Plan | null | undefined): boolean {
  if (!plan || !PLAN_LIMITS[plan]) {
    return false;
  }
  return currentCount < PLAN_LIMITS[plan].products;
}

export function canAddCompetitorStore(currentCount: number, plan: Plan | null | undefined): boolean {
  if (!plan || !PLAN_LIMITS[plan]) {
    return false;
  }
  return currentCount < PLAN_LIMITS[plan].stores;
}

export function hasAiChatAccess(plan: Plan | null | undefined): boolean {
  if (!plan || !PLAN_LIMITS[plan]) {
    return false;
  }
  return PLAN_LIMITS[plan].aiChat;
}

export function canSync(plan: Plan | null | undefined, lastSyncTime?: Date): boolean {
  if (!plan || !PLAN_LIMITS[plan]) {
    return false;
  }
  const limits = PLAN_LIMITS[plan];
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
  pro: {
    maxProducts: PLAN_LIMITS.pro.products,
    competitorTracking: true,
    reports: true,
    support: PLAN_LIMITS.pro.support,
  },
  ultra: {
    maxProducts: PLAN_LIMITS.ultra.products,
    competitorTracking: true,
    reports: true,
    support: PLAN_LIMITS.ultra.support,
  },
};
