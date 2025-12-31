import { createClient } from "@/lib/supabase/server";

export type TrialStatus = {
  trial_active: boolean;
  trial_days_left: number | null;
};

/**
 * Get trial status from profile_trial_status view
 * Returns null if view doesn't exist or user has no trial data
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("profile_trial_status")
    .select("trial_active, trial_days_left")
    .eq("id", userId)
    .maybeSingle();
  
  if (error) {
    console.error("[trial] Error fetching trial status:", error);
    return null;
  }
  
  if (!data) {
    return null;
  }
  
  return {
    trial_active: data.trial_active ?? false,
    trial_days_left: data.trial_days_left ?? null,
  };
}

/**
 * Check if user has full trial access (plan === "free_demo" AND trial_active === true)
 * Returns true if they have full PRO access via active trial
 */
export function hasTrialAccess(plan: string | null | undefined, trialActive: boolean): boolean {
  return plan === "free_demo" && trialActive === true;
}

/**
 * Check if actions should be blocked (plan === "free_demo" AND trial_active === false)
 * Returns true if user should be in read-only mode
 */
export function isTrialBlocked(plan: string | null | undefined, trialActive: boolean): boolean {
  return plan === "free_demo" && trialActive === false;
}

/**
 * Get effective plan for access checks
 * If plan is "free_demo" with active trial, treat as "pro" for limits
 * Otherwise return the plan as-is
 */
export function getEffectivePlan(
  plan: string | null | undefined,
  trialActive: boolean
): string {
  if (hasTrialAccess(plan, trialActive)) {
    return "pro"; // Active trial gets PRO access
  }
  return plan || "free_demo";
}

