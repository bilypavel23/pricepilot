import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { isAmazonUrl } from "@/lib/competitors/validation";

const STARTER_MAX_COMPETITORS = 2;
const PRO_MAX_COMPETITORS = 5;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, url } = body as {
      name?: string;
      url: string;
    };

    if (!url) {
      return NextResponse.json(
        { error: "Missing url" },
        { status: 400 }
      );
    }

    // Block Amazon URLs
    if (isAmazonUrl(url)) {
      return NextResponse.json(
        { error: "Amazon is not supported due to heavy anti-scraping protections." },
        { status: 400 }
      );
    }

    // Get or create store (automatically creates one if none exists)
    const store = await getOrCreateStore();

    // 1) Zjisti plán uživatele
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = (profile?.plan as string) ?? "STARTER";

    // 2) Spočítej kolik competitorů už pro ten store má
    const { data: competitors, error: countErr } = await supabase
      .from("competitors")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id);

    if (countErr) {
      console.error("competitors count error:", JSON.stringify(countErr, null, 2));
      return NextResponse.json(
        { error: "Failed to count competitors" },
        { status: 500 }
      );
    }

    const currentCount = competitors?.length ?? 0;

    const maxCompetitors =
      plan === "PRO" ? PRO_MAX_COMPETITORS : STARTER_MAX_COMPETITORS;

    if (currentCount >= maxCompetitors) {
      return NextResponse.json(
        {
          error: "Competitor limit reached for your plan.",
          limit: maxCompetitors,
        },
        { status: 403 }
      );
    }

    // 3) Insert new competitor store with status 'ready' initially (will change to 'processing' when discovery starts)
    // CRITICAL: Use server-side Supabase, return the REAL DB id from select('*')
    const { data: inserted, error: insertErr } = await supabase
      .from("competitors")
      .insert({
        store_id: store.id,
        url: url.trim(),
        name: name?.trim() ?? null,
        status: "ready", // Initial status - will be set to 'processing' when discovery starts
        source: "store",
        is_tracked: true,
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("[POST /api/competitors] competitor insert error:", JSON.stringify({
        error: insertErr,
        storeId: store.id,
        url: url.trim(),
        name: name?.trim() ?? null,
      }, null, 2));
      return NextResponse.json(
        { error: "Failed to create competitor" },
        { status: 500 }
      );
    }

    if (!inserted || !inserted.id) {
      console.error("[POST /api/competitors] Insert succeeded but no data returned:", {
        storeId: store.id,
        url: url.trim(),
      });
      return NextResponse.json(
        { error: "Failed to create competitor: no data returned" },
        { status: 500 }
      );
    }

    console.log("[POST /api/competitors] Competitor created successfully:", {
      competitorId: inserted.id,
      storeId: store.id,
      url: url.trim(),
      name: inserted.name,
      status: inserted.status,
    });

    // Return the inserted competitor with REAL DB id
    // DO NOT trigger discovery here - frontend will call /api/competitors/[id]/discover
    return NextResponse.json(
      {
        ok: true,
        competitor: inserted,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error in POST /api/competitors:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

