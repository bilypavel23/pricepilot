import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { getPlanConfig } from "@/lib/plan";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";
import { normalizePlan } from "@/lib/planLimits";
import { getOrCreateStoreSyncSettings } from "@/lib/competitors/syncSettings";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { user, profile, entitlements } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  // Use entitlements for effective plan and sync times
  const effectivePlan = entitlements?.effectivePlan ?? profile?.plan ?? "free_demo";
  const maxDailySyncTimes = entitlements?.maxDailySyncTimes ?? 1;
  
  // Get plan config - getPlanConfig now handles case-insensitive matching
  const planConfig = getPlanConfig(effectivePlan as any);
  
  // Get normalized plan for currentPlan prop (needs to match Plan type from planLimits)
  const normalizedPlan = normalizePlan(effectivePlan);

  // Get store with sync settings
  const store = await getOrCreateStore();

  // Load sync settings directly from store_sync_settings
  const supabase = await createClient();
  const { data: syncSettingsData } = await supabase
    .from("store_sync_settings")
    .select("timezone, daily_sync_times, last_competitor_sync_at, last_competitor_sync_status, last_competitor_sync_updated_count")
    .eq("store_id", store.id)
    .maybeSingle();

  // If row doesn't exist, create it with defaults
  let syncSettings: {
    timezone: string;
    daily_sync_times: string[];
  };
  let syncResults: {
    last_competitor_sync_at: string | null;
    last_competitor_sync_status: string | null;
    last_competitor_sync_updated_count: number | null;
  } | null = null;

  if (!syncSettingsData) {
    // Create with defaults based on entitlements.maxDailySyncTimes
    // Pro/trial (maxDailySyncTimes >= 2) gets 2 times, Starter gets 1 time
    const { getDefaultSyncTimes } = await import("@/lib/competitors/syncSettings");
    const defaultTimes = getDefaultSyncTimes(profile, user.created_at, profile?.plan);
    
    const { data: created } = await supabase
      .from("store_sync_settings")
      .upsert({
        store_id: store.id,
        timezone: "Europe/Prague", // Store as IANA in DB
        daily_sync_times: defaultTimes,
      }, { onConflict: "store_id" })
      .select("timezone, daily_sync_times")
      .single();

    syncSettings = created || {
      timezone: "Europe/Prague",
      daily_sync_times: defaultTimes,
    };
  } else {
    syncSettings = {
      timezone: syncSettingsData.timezone,
      daily_sync_times: syncSettingsData.daily_sync_times,
    };
    syncResults = {
      last_competitor_sync_at: syncSettingsData.last_competitor_sync_at || null,
      last_competitor_sync_status: syncSettingsData.last_competitor_sync_status || null,
      last_competitor_sync_updated_count: syncSettingsData.last_competitor_sync_updated_count || null,
    };
  }

  return (
    <SettingsClient
      userEmail={user.email || ""}
      store={store}
      storeName={store.name || "My Store"}
      currentPlan={normalizedPlan}
      planLabel={planConfig.label}
      syncsPerDay={maxDailySyncTimes}
      initialTimezone={syncSettings.timezone}
      initialTimes={syncSettings.daily_sync_times}
      lastCompetitorSyncAt={syncResults?.last_competitor_sync_at || null}
      lastCompetitorSyncStatus={syncResults?.last_competitor_sync_status || null}
      lastCompetitorSyncUpdatedCount={syncResults?.last_competitor_sync_updated_count || null}
    />
  );
}
