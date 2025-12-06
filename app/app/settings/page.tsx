import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { getPlanConfig } from "@/lib/plan";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";
import { normalizePlan } from "@/lib/planLimits";

export default async function SettingsPage() {
  const { user, profile } = await getProfile();

  if (!user) {
    redirect("/sign-in");
  }

  // Get plan config - getPlanConfig now handles case-insensitive matching
  const planConfig = getPlanConfig(profile?.plan as any);
  
  // Get normalized plan for currentPlan prop (needs to match Plan type from planLimits)
  const normalizedPlan = normalizePlan(profile?.plan);

  // Get store with sync settings
  const store = await getOrCreateStore();

  return (
    <SettingsClient
      userEmail={user.email || ""}
      storeName={store.name || "My Store"}
      currentPlan={normalizedPlan}
      planLabel={planConfig.label}
      syncsPerDay={planConfig.syncsPerDay}
      initialTimezone={store.competitor_sync_timezone || store.timezone || "Europe/Prague"}
      initialTimes={store.competitor_sync_times as string[] | null}
    />
  );
}
