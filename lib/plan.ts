export type PlanId = 'free_demo' | 'STARTER' | 'pro' | 'ultra';

export type PlanConfig = {
  id: PlanId;
  label: string;
  productLimit: number;
  competitorsPerProduct: number;
  storesLimit: number;
  syncsPerDay: number;
  autoPricing: boolean;
  bulkApply: boolean;
};

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  free_demo: {
    id: 'free_demo',
    label: 'Free Demo',
    productLimit: 50,
    competitorsPerProduct: 1,
    storesLimit: 1,
    syncsPerDay: 0,
    autoPricing: false,
    bulkApply: false,
  },
  STARTER: {
    id: 'STARTER',
    label: 'Starter',
    productLimit: 50,
    competitorsPerProduct: 2,
    storesLimit: 1,
    syncsPerDay: 1,
    autoPricing: false,
    bulkApply: false,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    productLimit: 200,
    competitorsPerProduct: 5,
    storesLimit: 3,
    syncsPerDay: 2,
    autoPricing: true,
    bulkApply: true,
  },
  ultra: {
    id: 'ultra',
    label: 'Scale',
    productLimit: 400,
    competitorsPerProduct: 10,
    storesLimit: 10,
    syncsPerDay: 4,
    autoPricing: true,
    bulkApply: true,
  },
};

export function getPlanConfig(plan: PlanId | null | undefined): PlanConfig {
  if (!plan) return PLAN_CONFIG.free_demo;
  
  // Handle case-insensitive matching for common variations
  const normalized = plan.toLowerCase();
  if (normalized === 'pro' || normalized === 'professional') {
    return PLAN_CONFIG.pro;
  }
  if (normalized === 'ultra' || normalized === 'scale' || normalized === 'enterprise') {
    return PLAN_CONFIG.ultra;
  }
  if (normalized === 'starter' || normalized === 'basic') {
    return PLAN_CONFIG.STARTER;
  }
  if (normalized === 'free_demo' || normalized === 'demo' || normalized === 'free') {
    return PLAN_CONFIG.free_demo;
  }
  
  // Try direct lookup
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG.free_demo;
}

