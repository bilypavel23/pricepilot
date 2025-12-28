import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findBestMatches } from "@/lib/competitors/matching";
import { scrapeCompetitorProducts } from "@/lib/competitors/scrape";
import { isAmazonUrl } from "@/lib/competitors/validation";
import { getHoursBetweenSyncs, getSyncsPerDay } from "@/lib/plans";
import { checkSyncLimit, recordSyncRun } from "@/lib/enforcement/syncLimits";

interface Params {
  params: Promise<{ competitorId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const supabase = await createClient();
    const { competitorId } = await params;

    // 1) Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Find competitor store + its store_id
    const { data: competitor, error: compError } = await supabase
      .from("competitors")
      .select("id, store_id, url, last_sync_at")
      .eq("id", competitorId)
      .single();

    if (compError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    const storeId = competitor.store_id;

    // Block Amazon URLs
    if (isAmazonUrl(competitor.url as string)) {
      return NextResponse.json(
        { error: "Amazon is not supported." },
        { status: 400 }
      );
    }

    // 3) Get plan and enforce sync limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan;

    // Check daily sync limit
    const syncLimitCheck = await checkSyncLimit(storeId, plan);
    if (!syncLimitCheck.allowed) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: syncLimitCheck.reason || "Sync limit reached for today.",
          todayCount: syncLimitCheck.todayCount,
          limit: syncLimitCheck.limit,
          nextAllowedAt: syncLimitCheck.nextAllowedAt?.toISOString(),
        },
        { status: 200 }
      );
    }

    // Check cooldown between syncs
    const hoursBetweenSync = getHoursBetweenSyncs(plan);

    if (competitor.last_sync_at) {
      const last = new Date(competitor.last_sync_at);
      const nextAllowed = new Date(
        last.getTime() + hoursBetweenSync * 60 * 60 * 1000
      );
      if (nextAllowed > new Date()) {
        return NextResponse.json(
          {
            ok: true,
            skipped: true,
            reason: `Sync already run recently. Next sync available at ${nextAllowed.toISOString()}`,
            nextAllowedAt: nextAllowed.toISOString(),
          },
          { status: 200 }
        );
      }
    }

    // 4) Load my products for this store
    const { data: myProducts, error: myErr } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("store_id", storeId)
      .eq("status", "active");

    if (myErr) {
      console.error("My products load error:", myErr);
      return NextResponse.json(
        { error: "Failed to load products" },
        { status: 500 }
      );
    }

    // 5) Scrape competitor
    const competitorUrl = competitor.url as string;
    const scraped = await scrapeCompetitorProducts(competitorUrl);

    // 6) Upsert competitor_products
    const upsertPayload = (scraped ?? []).map((p) => ({
      competitor_id: competitorId,
      external_id: p.external_id ?? null,
      name: p.name,
      sku: null,
      price: p.price ?? null,
      currency: "USD",
      url: p.url ?? null,
      raw: p.raw ?? null,
    }));

    const { data: competitorProducts, error: cpErr } = await supabase
      .from("competitor_products")
      .upsert(upsertPayload, {
        onConflict: "competitor_id,name,sku",
        ignoreDuplicates: false,
      })
      .select("id, name, sku");

    if (cpErr) {
      console.error("Upsert competitor_products error:", cpErr);
      return NextResponse.json(
        { error: "Failed to save competitor products" },
        { status: 500 }
      );
    }

    // 7) Find best matches
    const matches = findBestMatches(
      (myProducts ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        sku: (p.sku as string | null) ?? undefined,
      })),
      (competitorProducts ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        sku: (p.sku as string | null) ?? undefined,
      })),
      60 // minScore
    );

    // 8) Save to product_matches (pending / auto_confirmed)
    const now = new Date().toISOString();
    const rows = matches.map((m) => ({
      store_id: storeId,
      product_id: m.productId,
      competitor_product_id: m.competitorProductId,
      similarity: m.similarity,
      status: m.similarity >= 90 ? "auto_confirmed" : "pending",
      created_at: now,
      updated_at: now,
    }));

    if (rows.length) {
      const { error: pmErr } = await supabase
        .from("product_matches")
        .upsert(rows, {
          onConflict: "product_id,competitor_product_id",
        });

      if (pmErr) {
        console.error("product_matches upsert error:", pmErr);
        return NextResponse.json(
          { error: "Failed to save matches" },
          { status: 500 }
        );
      }
    }

    // 9) Update last_sync_at
    await supabase
      .from("competitors")
      .update({ last_sync_at: now })
      .eq("id", competitorId);

    // 10) Record sync run for daily limit tracking
    await recordSyncRun(storeId);

    return NextResponse.json(
      {
        ok: true,
        matched: rows.length,
        autoConfirmed: rows.filter((r) => r.status === "auto_confirmed")
          .length,
        syncsRemaining: syncLimitCheck.remaining - 1,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Competitor sync error:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
