import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>; // store_id
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const supabase = createClient();
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

    if (!timezone || !dailySyncTimes || dailySyncTimes.length === 0) {
      return NextResponse.json(
        { error: "Missing timezone or daily_sync_times" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("store_sync_settings")
      .upsert(
        {
          store_id: storeId,
          timezone,
          daily_sync_times: dailySyncTimes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" }
      )
      .select("store_id, timezone, daily_sync_times")
      .single();

    if (error) {
      console.error("store_sync_settings upsert error:", error);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: data }, { status: 200 });
  } catch (e) {
    console.error("PUT /api/stores/[id]/sync-settings error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


