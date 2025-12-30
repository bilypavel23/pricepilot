import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>; // store_id
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const supabase = await createClient();
    const { id: storeId } = await params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns the store
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", storeId)
      .eq("owner_id", user.id)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await req.json();
    const syncEnabled = body.sync_enabled as boolean | undefined;
    const timezoneValue = body.timezone as string | undefined;
    const dailySyncTimes = body.daily_sync_times as string[] | undefined;

    if (timezoneValue === undefined) {
      return NextResponse.json(
        { error: "Missing timezone" },
        { status: 400 }
      );
    }

    // Get existing row to preserve sync_frequency if it exists
    const { data: existing } = await supabase
      .from("store_sync_settings")
      .select("sync_frequency")
      .eq("store_id", storeId)
      .maybeSingle();

    // Preserve existing sync_frequency or default to 'daily'
    const syncFrequency = existing?.sync_frequency || "daily";

    // Normalize timezone: accept both UI label and IANA format
    // Map common labels to IANA timezones
    const timezoneMap: Record<string, string> = {
      "Europe — Prague": "Europe/Prague",
      "Europe — Berlin": "Europe/Berlin",
      "Europe — Vienna": "Europe/Vienna",
      "Europe — Warsaw": "Europe/Warsaw",
      "Europe — Budapest": "Europe/Budapest",
      "Europe — Paris": "Europe/Paris",
      "Europe — Rome": "Europe/Rome",
      "Europe — Madrid": "Europe/Madrid",
      "Europe — Amsterdam": "Europe/Amsterdam",
      "Europe — Brussels": "Europe/Brussels",
      "Europe — Stockholm": "Europe/Stockholm",
      "Europe — Copenhagen": "Europe/Copenhagen",
      "Europe — Oslo": "Europe/Oslo",
      "Europe — Helsinki": "Europe/Helsinki",
      "Europe — Dublin": "Europe/Dublin",
      "Europe — Lisbon": "Europe/Lisbon",
      "Europe — London": "Europe/London",
      "Europe — Zurich": "Europe/Zurich",
      "Europe — Athens": "Europe/Athens",
      "Europe — Istanbul": "Europe/Istanbul",
      "Europe — Kyiv": "Europe/Kyiv",
      "Europe — Bucharest": "Europe/Bucharest",
      "America — New York (ET)": "America/New_York",
      "America — Detroit (ET)": "America/Detroit",
      "America — Chicago (CT)": "America/Chicago",
      "America — Winnipeg (CT)": "America/Winnipeg",
      "America — Denver (MT)": "America/Denver",
      "America — Edmonton (MT)": "America/Edmonton",
      "America — Phoenix (AZ / no DST)": "America/Phoenix",
      "America — Los Angeles (PT)": "America/Los_Angeles",
      "America — Vancouver (PT)": "America/Vancouver",
      "America — Anchorage (AK)": "America/Anchorage",
      "Pacific — Honolulu (HI)": "Pacific/Honolulu",
      "America — Halifax (Atlantic)": "America/Halifax",
      "America — St. John's (Newfoundland)": "America/St_Johns",
      "America — Toronto (Canada ET)": "America/Toronto",
      "America — Montreal (Canada ET)": "America/Montreal",
      "America — Calgary (Canada MT)": "America/Calgary",
      "UTC": "UTC",
    };

    // Normalize timezone: if it's a label, convert to IANA; if already IANA, use as-is
    const timezone = timezoneMap[timezoneValue] || timezoneValue;

    // Validate and format times: ensure "HH:mm" format with zero-padding
    const formattedTimes = (dailySyncTimes || [])
      .map((t) => {
        const trimmed = t.trim();
        if (!trimmed) return null;
        // Parse and format to ensure "HH:mm" format
        const parts = trimmed.split(":");
        if (parts.length !== 2) return null;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          return null;
        }
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      })
      .filter((t): t is string => t !== null);

    // Remove duplicates and sort ascending
    const uniqueTimes = Array.from(new Set(formattedTimes));
    const sortedTimes = uniqueTimes.sort((a, b) => {
      const [aH, aM] = a.split(":").map(Number);
      const [bH, bM] = b.split(":").map(Number);
      const aMinutes = aH * 60 + aM;
      const bMinutes = bH * 60 + bM;
      return aMinutes - bMinutes;
    });

    // Ensure at least one time (default to 06:00 if empty)
    const syncTimes = sortedTimes.length > 0 ? sortedTimes : ["06:00"];

    // Upsert with all required fields
    const { data, error } = await supabase
      .from("store_sync_settings")
      .upsert(
        {
          store_id: storeId,
          sync_enabled: syncEnabled ?? true,
          sync_frequency: syncFrequency,
          timezone,
          daily_sync_times: syncTimes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" }
      )
      .select("store_id, sync_enabled, sync_frequency, timezone, daily_sync_times")
      .single();

    if (error) {
      const errorStatus = (error as any)?.status ?? null;
      console.error("store_sync_settings upsert error:", {
        storeId,
        message: error?.message || "Unknown error",
        code: error?.code || "NO_CODE",
        details: error?.details || null,
        hint: error?.hint || null,
        status: errorStatus,
      });
      return NextResponse.json(
        { error: error.message || "Failed to save sync settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, settings: data }, { status: 200 });
  } catch (e) {
    console.error("PUT /api/stores/[id]/sync-settings error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


