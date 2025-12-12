import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findBestMatches } from "@/lib/competitors/matching";
import { scrapeCompetitorProducts } from "@/lib/competitors/scrape";
import { isAmazonUrl } from "@/lib/competitors/validation";

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

    // 2) Najdi competitor store + jeho store_id (můj shop)
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

    // 3) Zjisti plán a frekvenci (Starter 1×, Pro 4× denně)
    // Pro jednoduchost jen limit v hodinách:
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan ?? "STARTER";
    const hoursBetweenSync =
      plan === "PRO" ? 6 : 24; // PRO ~ 4x / STARTER ~ 1x

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
            reason: "Sync already run recently for this plan.",
          },
          { status: 200 }
        );
      }
    }

    // 4) Načti moje produkty pro tento store
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

    // 5) Scrap konkurenta
    const competitorUrl = competitor.url as string;
    const scraped = await scrapeCompetitorProducts(competitorUrl);

    // 6) Upsert competitor_products
    //  - můžeš použí t external_id jako unique klíč, tady použijeme (competitor_id, name, sku)
    const upsertPayload = (scraped ?? []).map((p) => ({
      competitor_id: competitorId,
      external_id: p.external_id ?? null,
      name: p.name,
      sku: null, // momentálně neřešíme
      price: p.price ?? null,
      currency: "USD", // nebo nech default v DB
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

    // 7) Najdi best matches
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

    // 8) Ulož do product_matches (pending / auto_confirmed)
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
        // není fatální, ale vrátíme error
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

    return NextResponse.json(
      {
        ok: true,
        matched: rows.length,
        autoConfirmed: rows.filter((r) => r.status === "auto_confirmed")
          .length,
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

