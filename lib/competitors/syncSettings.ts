import { createClient } from "@/lib/supabase/server";

export type StoreSyncSettings = {
  store_id: string;
  sync_enabled: boolean;
  timezone: string;
  daily_sync_times: string[]; // ['06:00', '12:00', ...]
};

/**
 * Default sync times based on plan.
 * PRO: 2x per day – every 12 hours (06:00 and 18:00)
 * ULTRA/SCALE: 4x per day – every 6 hours
 * STARTER/other: 1x per day – 06:00
 */
export function getDefaultSyncTimes(plan?: string | null): string[] {
  const normalized = (plan ?? "STARTER").toUpperCase();
  if (normalized === "ULTRA" || normalized === "SCALE") {
    return ["06:00", "12:00", "18:00", "00:00"];
  }
  if (normalized === "PRO") {
    return ["06:00", "18:00"];
  }
  // Starter / Free
  return ["06:00"];
}

/**
 * Load or create sync settings for a store.
 */
export async function getOrCreateStoreSyncSettings(
  storeId: string,
  userId: string
): Promise<StoreSyncSettings> {
  const supabase = await createClient();

  // get user plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = profile?.plan ?? "STARTER";

  // try existing row
  const { data: existing } = await supabase
    .from("store_sync_settings")
    .select("store_id, sync_enabled, timezone, daily_sync_times")
    .eq("store_id", storeId)
    .maybeSingle();

  if (existing) {
    return {
      store_id: existing.store_id,
      sync_enabled: existing.sync_enabled ?? true,
      timezone: existing.timezone,
      daily_sync_times: existing.daily_sync_times,
    } as StoreSyncSettings;
  }

  // create new with defaults
  const defaults: StoreSyncSettings = {
    store_id: storeId,
    sync_enabled: true,
    timezone: "Europe/Prague",
    daily_sync_times: getDefaultSyncTimes(plan),
  };

  // Use upsert instead of insert to handle duplicate store_id gracefully
  const { data: upserted, error } = await supabase
    .from("store_sync_settings")
    .upsert(
      {
        store_id: defaults.store_id,
        sync_enabled: defaults.sync_enabled,
        timezone: defaults.timezone,
        daily_sync_times: defaults.daily_sync_times,
      },
      { onConflict: "store_id" }
    )
    .select("store_id, sync_enabled, timezone, daily_sync_times")
    .single();

  if (error || !upserted) {
    // If upsert fails (e.g., RLS policy, table doesn't exist), just return defaults
    // This allows the app to continue working even if sync settings table isn't set up yet
    const errorStatus = (error as any)?.status ?? null;
    console.warn("Failed to upsert store_sync_settings, using defaults:", {
      storeId,
      message: error?.message || "Unknown error",
      code: error?.code || "NO_CODE",
      details: error?.details || null,
      hint: error?.hint || null,
      status: errorStatus,
    });
    return defaults;
  }

  return upserted as StoreSyncSettings;
}

/**
 * Given sync settings and current time, compute the next sync Date.
 * Uses server timezone as approximation; timezone string is more for display.
 */
export function computeNextSyncDate(
  settings: StoreSyncSettings,
  now: Date = new Date()
): Date | null {
  const times = settings.daily_sync_times;
  if (!times || times.length === 0) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let nextTime: { hour: number; minute: number } | null = null;
  let minDiff = Number.POSITIVE_INFINITY;

  for (const t of times) {
    const [hStr, mStr] = t.split(":");
    const hour = Number(hStr);
    const minute = Number(mStr ?? "0");
    const minutesOfDay = hour * 60 + minute;

    let diff = minutesOfDay - currentMinutes;
    if (diff <= 0) {
      diff += 24 * 60; // next day
    }

    if (diff < minDiff) {
      minDiff = diff;
      nextTime = { hour, minute };
    }
  }

  if (!nextTime) return null;

  const result = new Date(now);
  result.setHours(nextTime.hour, nextTime.minute, 0, 0);

  // if time already passed today, move to tomorrow
  if (result <= now) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Format "in X hours" style text for UI.
 */
export function formatNextSyncDistance(nextSync: Date | null, now = new Date()): string {
  if (!nextSync) return "not scheduled";

  const diffMs = nextSync.getTime() - now.getTime();
  if (diffMs <= 0) return "soon";

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `in ${minutes} min`;
  }

  if (minutes === 0) {
    return `in ${hours} hours`;
  }

  return `in ${hours} h ${minutes} min`;
}

/**
 * Simple formatter for time "at HH:MM".
 */
export function formatTimeHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

