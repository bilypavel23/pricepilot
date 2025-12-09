import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { timezone, times } = body as {
      timezone: string | null;
      times: string[];
    };

    // Get user's store
    const store = await getOrCreateStore();

    // Normalize times to HH:MM and limit length server-side
    const normalizedTimes =
      Array.isArray(times) && times.length > 0
        ? times
            .map((t) => (typeof t === "string" ? t.trim() : ""))
            .filter((t) => t.match(/^\d{2}:\d{2}$/))
        : [];

    const { error: updateError } = await supabase
      .from("stores")
      .update({
        competitor_sync_timezone: timezone || null,
        competitor_sync_times: normalizedTimes.length > 0 ? normalizedTimes : null,
      })
      .eq("id", store.id);

    if (updateError) {
      console.error("Error updating competitor sync settings:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in POST /api/settings/competitor-sync:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}




