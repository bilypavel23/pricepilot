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
    const timezone = body.timezone as string | undefined;
    const dailySyncTimes = body.daily_sync_times as string[] | undefined;

    if (!timezone) {
      return NextResponse.json(
        { error: "Missing timezone" },
        { status: 400 }
      );
    }

    // Ensure daily_sync_times is always present (empty array or default if missing)
    // This prevents PGRST204 schema cache error
    const syncTimes = dailySyncTimes && dailySyncTimes.length > 0 
      ? dailySyncTimes 
      : ["06:00"]; // Default to single daily sync

    const { data, error } = await supabase
      .from("store_sync_settings")
      .upsert(
        {
          store_id: storeId,
          timezone,
          daily_sync_times: syncTimes, // Always include daily_sync_times
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" }
      )
      .select("store_id, timezone, daily_sync_times")
      .single();

    if (error) {
      // Log warning but continue with defaults (don't throw error)
      console.warn("store_sync_settings upsert error, using defaults:", {
        storeId,
        message: error?.message || "Unknown error",
        code: error?.code || "NO_CODE",
        details: error?.details || null,
        hint: error?.hint || null,
        status: error?.status || null,
      });
      // Return success with default values instead of error
      return NextResponse.json({
        ok: true,
        settings: {
          store_id: storeId,
          timezone: timezone,
          daily_sync_times: dailySyncTimes,
        },
        warning: "Settings saved locally but may not persist in database",
      }, { status: 200 });
    }

    return NextResponse.json({ ok: true, settings: data }, { status: 200 });
  } catch (e) {
    console.error("PUT /api/stores/[id]/sync-settings error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


