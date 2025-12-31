import { createClient } from "@/lib/supabase/server";
import { getPlanConfig, PlanId } from "./plan";
import { getTrialInfo } from "./billing/trial";
import { getEntitlements } from "./billing/entitlements";

export async function getProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null, planConfig: getPlanConfig(null), trialInfo: null, entitlements: null };
  }

  // Get profile from database
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return { user, profile: null, planConfig: getPlanConfig(null), trialInfo: null, entitlements: null };
  }

  // Use user.created_at for trial calculation (fallback to profile.created_at)
  const userCreatedAt = user.created_at || profile?.created_at;

  // Get trial info using new helper
  const trialInfo = getTrialInfo(profile, userCreatedAt);

  // Get entitlements
  const entitlements = getEntitlements(profile, userCreatedAt);

  // Use effective_plan for plan config
  const planConfig = getPlanConfig((entitlements.effectivePlan as PlanId) || null);

  return { user, profile, planConfig, trialInfo, entitlements };
}

