import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCompetitorDiscovery } from "@/lib/competitors/discovery";

/**
 * Debug route to manually trigger discovery scrape
 * GET /api/debug/discovery-run?storeId=...&competitorId=...
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const competitorId = searchParams.get("competitorId");

    if (!storeId || !competitorId) {
      return NextResponse.json(
        { error: "Missing storeId or competitorId query params" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load competitor to get URL
    const { data: competitor, error: competitorError } = await supabase
      .from("competitors")
      .select("id, url, store_id")
      .eq("id", competitorId)
      .eq("store_id", storeId)
      .single();

    if (competitorError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    // Get plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan || null;

    // Run discovery
    console.log("[debug/discovery-run] Starting discovery", {
      competitorId,
      storeId,
      url: competitor.url,
    });

    const result = await runCompetitorDiscovery({
      storeId,
      competitorId,
      competitorUrl: competitor.url,
      plan,
    });

    return NextResponse.json({
      ok: true,
      success: result.success,
      productsScraped: result.productsScraped,
      error: result.error,
    });
  } catch (err: any) {
    console.error("Error in GET /api/debug/discovery-run:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}




