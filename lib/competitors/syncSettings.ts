import { createClient } from "@/lib/supabase/server";

export type StoreSyncSettings = {
  store_id: string;
  timezone: string;
  daily_sync_times: string[]; // ['06:00', '12:00', ...]
};

/**
 * Default sync times based on plan.
 * PRO: 4x per day – every 6 hours starting at 06:00
 * STARTER/other: 1x per day – 06:00
 */
export function getDefaultSyncTimes(plan?: string | null): string[] {
  const normalized = (plan ?? "STARTER").toUpperCase();
  if (normalized === "PRO") {
    return ["06:00", "12:00", "18:00", "00:00"];
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
  const supabase = createClient();

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
    .select("store_id, timezone, daily_sync_times")
    .eq("store_id", storeId)
    .maybeSingle();

  if (existing) {
    return existing as StoreSyncSettings;
  }

  // create new with defaults
  const defaults: StoreSyncSettings = {
    store_id: storeId,
    timezone: "Europe/Prague",
    daily_sync_times: getDefaultSyncTimes(plan),
  };

  const { data: inserted, error } = await supabase
    .from("store_sync_settings")
    .insert({
      store_id: defaults.store_id,
      timezone: defaults.timezone,
      daily_sync_times: defaults.daily_sync_times,
    })
    .select("store_id, timezone, daily_sync_times")
    .single();

  if (error || !inserted) {
    // If insert fails (e.g., RLS policy, table doesn't exist), just return defaults
    // This allows the app to continue working even if sync settings table isn't set up yet
    console.warn("Failed to insert store_sync_settings, using defaults:", error?.message || error);
    return defaults;
  }

  return inserted as StoreSyncSettings;
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

