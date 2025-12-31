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

  // Get profile from database - use maybeSingle() to avoid throwing when profile doesn't exist
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    // Continue with safe defaults below instead of returning null
  }

  // If profile is null, create a safe default object from user metadata
  let safeProfile = profile;
  if (!safeProfile) {
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 days from now

    const userMetadata = user.user_metadata || {};
    safeProfile = {
      id: user.id,
      plan: userMetadata.plan || "free_demo",
      full_name: userMetadata.full_name || null,
      trial_active: true,
      trial_started_at: userMetadata.trial_started_at || now.toISOString(),
      trial_ends_at: userMetadata.trial_ends_at || trialEndsAt.toISOString(),
      terms_accepted: userMetadata.terms_accepted !== undefined ? userMetadata.terms_accepted : true,
      terms_accepted_at: userMetadata.terms_accepted_at || now.toISOString(),
      created_at: user.created_at || now.toISOString(),
    };
  }

  // Use user.created_at for trial calculation (fallback to profile.created_at)
  const userCreatedAt = user.created_at || safeProfile?.created_at;

  // Get trial info using new helper
  const trialInfo = getTrialInfo(safeProfile, userCreatedAt);

  // Get entitlements
  const entitlements = getEntitlements(safeProfile, userCreatedAt);

  // Use effective_plan for plan config
  const planConfig = getPlanConfig((entitlements.effectivePlan as PlanId) || null);

  return { user, profile: safeProfile, planConfig, trialInfo, entitlements };
}

