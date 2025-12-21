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

    // 3) Insert new competitor store with status 'pending' and source='store'
    const { data: inserted, error: insertErr } = await supabase
      .from("competitors")
      .insert({
        store_id: store.id,
        url: url.trim(),
        name: name?.trim() ?? null,
        status: "pending",
        source: "store",
        is_tracked: true,
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("competitor insert error:", JSON.stringify(insertErr, null, 2));
      return NextResponse.json(
        { error: "Failed to create competitor" },
        { status: 500 }
      );
    }

    // 4) Trigger discovery scrape asynchronously (don't wait)
    // Use internal function to avoid HTTP overhead
    console.log("[POST /api/competitors] Starting discovery scrape", {
      competitorId: inserted.id,
      storeId: store.id,
      url: url.trim(),
    });

    // Run discovery in background (don't await)
    import("@/lib/competitors/discovery")
      .then(({ runCompetitorDiscovery }) => {
        return runCompetitorDiscovery({
          storeId: store.id,
          competitorId: inserted.id,
          competitorUrl: url.trim(),
          plan: plan,
        });
      })
      .then((result) => {
        console.log("[POST /api/competitors] Discovery completed", {
          competitorId: inserted.id,
          success: result.success,
          productsScraped: result.productsScraped,
          error: result.error,
        });
      })
      .catch((err) => {
        console.error("[POST /api/competitors] Failed to trigger discovery scrape:", {
          competitorId: inserted.id,
          error: err.message || "Unknown error",
          stack: err.stack,
        });
      });

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

