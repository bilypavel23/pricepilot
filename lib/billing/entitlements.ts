/**
 * Entitlements helper functions
 * Determines user's effective plan and feature access based on plan + trial status
 * SINGLE SOURCE OF TRUTH for all plan/feature/limit checks
 */

import { isTrialActive, getDaysLeft } from "./trial";

export type EffectivePlan = "starter" | "pro" | "ultra" | "free_demo";

export interface Entitlements {
  effectivePlan: EffectivePlan;
  trialActive: boolean;
  daysLeft: number;
  discoveryMonthlyLimit: number;
  maxDailySyncTimes: number;
  competitorLimitPerProduct: number;
  canUseAIChat: boolean;
  canWrite: boolean;
}

/**
 * Get effective plan from profile
 * If profile.plan === "free_demo" && trial is active => "pro"
 * Otherwise normalize profile.plan (lowercase; map "STARTER" to "starter")
 */
export function getEffectivePlan(
  profile: any,
  userCreatedAt?: string | Date
): EffectivePlan {
  const plan = profile?.plan;
  
  if (!plan) {
    return "free_demo";
  }

  // If free_demo with active trial, treat as pro
  if (plan === "free_demo" && isTrialActive(profile, userCreatedAt)) {
    return "pro";
  }

  // Normalize plan name
  const normalized = plan.toLowerCase().trim();
  
  // Map common variations
  if (normalized === "starter" || normalized === "basic") {
    return "starter";
  }
  if (normalized === "pro" || normalized === "professional") {
    return "pro";
  }
  if (normalized === "ultra" || normalized === "scale" || normalized === "enterprise") {
    return "ultra";
  }
  if (normalized === "free_demo" || normalized === "demo" || normalized === "free") {
    return "free_demo";
  }

  // Default fallback
  return "free_demo";
}

/**
 * Get user entitlements based on effective plan
 * This is the SINGLE SOURCE OF TRUTH for all plan/feature/limit checks
 */
export function getEntitlements(
  profile: any,
  userCreatedAt?: string | Date
): Entitlements {
  const effectivePlan = getEffectivePlan(profile, userCreatedAt);
  const trialActive = isTrialActive(profile, userCreatedAt);
  const daysLeft = getDaysLeft(profile, userCreatedAt);
  const rawPlan = profile?.plan;

  // PRO values (used when effectivePlan === "pro" or "ultra", or free_demo with active trial)
  const PRO_DISCOVERY_LIMIT = 6000;
  const PRO_SYNC_TIMES = 2;
  const PRO_COMPETITOR_LIMIT = 5; // competitors per product
  const PRO_AI_CHAT = true;

  // Discovery monthly limits
  const discoveryMonthlyLimit =
    effectivePlan === "pro" || effectivePlan === "ultra" ? PRO_DISCOVERY_LIMIT
    : effectivePlan === "starter" ? 2000
    : 0; // free_demo without active trial

  // Max daily sync times
  const maxDailySyncTimes =
    effectivePlan === "pro" || effectivePlan === "ultra" ? PRO_SYNC_TIMES
    : effectivePlan === "starter" ? 1
    : 0; // free_demo without active trial

  // Competitor limit per product
  const competitorLimitPerProduct =
    effectivePlan === "pro" || effectivePlan === "ultra" ? PRO_COMPETITOR_LIMIT
    : effectivePlan === "starter" ? 2
    : 0; // free_demo without active trial

  // AI Chat access
  const canUseAIChat =
    effectivePlan === "pro" || effectivePlan === "ultra" ? PRO_AI_CHAT
    : false;

  // Write access: allowed if effectivePlan !== "free_demo" OR (plan === "free_demo" && trialActive)
  // i.e. trialActive allows writes; expired free_demo blocks writes
  const canWrite = effectivePlan !== "free_demo" || (rawPlan === "free_demo" && trialActive);

  return {
    effectivePlan,
    trialActive,
    daysLeft,
    discoveryMonthlyLimit,
    maxDailySyncTimes,
    competitorLimitPerProduct,
    canUseAIChat,
    canWrite,
  };
}

