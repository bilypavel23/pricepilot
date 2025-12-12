import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { getPlanConfig } from "@/lib/plan";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";
import { normalizePlan } from "@/lib/planLimits";
import { getOrCreateStoreSyncSettings } from "@/lib/competitors/syncSettings";

export default async function SettingsPage() {
  const { user, profile } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  // Get plan config - getPlanConfig now handles case-insensitive matching
  const planConfig = getPlanConfig(profile?.plan as any);
  
  // Get normalized plan for currentPlan prop (needs to match Plan type from planLimits)
  const normalizedPlan = normalizePlan(profile?.plan);

  // Get store with sync settings
  const store = await getOrCreateStore();

  // Load sync settings using new helper (creates defaults if not exists)
  const syncSettings = await getOrCreateStoreSyncSettings(store.id, user.id);

  return (
    <SettingsClient
      userEmail={user.email || ""}
      store={store}
      storeName={store.name || "My Store"}
      currentPlan={normalizedPlan}
      planLabel={planConfig.label}
      syncsPerDay={planConfig.syncsPerDay}
      initialTimezone={syncSettings.timezone}
      initialTimes={syncSettings.daily_sync_times}
    />
  );
}
