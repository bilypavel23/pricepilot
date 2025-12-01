export type Plan = "STARTER" | "PRO" | "SCALE";

export const PLAN_LIMITS = {
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

// Legacy function for backward compatibility
export const planLimits: Record<
  Plan,
  { maxProducts: number; competitorTracking: boolean; reports: boolean; support: string }
> = {
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
