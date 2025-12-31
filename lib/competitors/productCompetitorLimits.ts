/**
 * Shared helper for product competitor limit UI
 * Single source of truth for competitor limit display and gating
 */

import { getEntitlements } from "@/lib/billing/entitlements";

export interface ProductCompetitorLimitUI {
  max: number;
  used: number;
  remaining: number;
  canAdd: boolean;
  reason?: string;
}

/**
 * Get product competitor limit UI state
 * Uses effective plan from entitlements (free_demo during trial => pro)
 * 
 * IMPORTANT: max must NEVER become 0 unless expired trial.
 * If profile missing, treat as starter until profile loads.
 */
export function getProductCompetitorLimitUI({
  profile,
  productId,
  competitorsLinkedCount,
  userCreatedAt,
}: {
  profile: any;
  productId: string;
  competitorsLinkedCount: number;
  userCreatedAt?: string | Date;
}): ProductCompetitorLimitUI {
  // If profile is null/undefined, treat as starter (default to starter, not 0)
  if (!profile) {
    return {
      max: 2, // Starter limit
      used: competitorsLinkedCount,
      remaining: Math.max(0, 2 - competitorsLinkedCount),
      canAdd: competitorsLinkedCount < 2,
      reason: "Profile loading, using starter limits",
    };
  }

  // Get entitlements (handles effective plan calculation including trial)
  const entitlements = getEntitlements(profile, userCreatedAt);
  
  // Get max from entitlements.competitorLimitPerProduct
  // This already handles:
  // - free_demo with active trial => pro => 5
  // - pro => 5
  // - starter => 2
  // - expired trial (free_demo) => 0
  const max = entitlements.competitorLimitPerProduct;
  const used = competitorsLinkedCount;
  const remaining = Math.max(0, max - used);
  const canAdd = max > 0 && used < max;

  // Build reason if limit reached or expired trial
  let reason: string | undefined;
  if (max === 0) {
    reason = "Your free trial has ended. Upgrade to continue.";
  } else if (!canAdd) {
    reason = `Limit reached (${used}/${max}). Delete a competitor or upgrade.`;
  }

  return {
    max,
    used,
    remaining,
    canAdd,
    reason,
  };
}

