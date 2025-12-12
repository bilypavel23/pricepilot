import { createClient } from "@/lib/supabase/server";
import { getPlanConfig, PlanId } from "./plan";

export async function getProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null, planConfig: getPlanConfig(null) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return { user, profile: null, planConfig: getPlanConfig(null) };
  }

  const planConfig = getPlanConfig((profile?.plan as PlanId) || null);

  return { user, profile, planConfig };
}

