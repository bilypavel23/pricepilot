import { createClient } from "@/lib/supabase/server";
import { isTrialBlocked } from "./trial";

/**
 * Check if trial blocks this action
 * Returns { blocked: true, message: string } if blocked, or { blocked: false } if allowed
 * Blocks writes when plan is free_demo AND trial_active is false
 */
export async function checkTrialBlock(userId: string, plan: string | null | undefined) {
  // Only check trial blocking for free_demo plans
  if (plan !== "free_demo") {
    return { blocked: false };
  }

  // Get trial status from v_profiles_effective view
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("v_profiles_effective")
    .select("trial_active, plan")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    // If no profile found, default to blocked for safety
    return {
      blocked: true,
      message: "Your free trial has ended. Upgrade to continue.",
    };
  }

  const trialActive = profile.trial_active ?? false;
  if (isTrialBlocked(plan, trialActive)) {
    return {
      blocked: true,
      message: "Your free trial has ended. Upgrade to continue.",
    };
  }

  return { blocked: false };
}

