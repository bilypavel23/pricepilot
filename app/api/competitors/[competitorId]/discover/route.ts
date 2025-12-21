import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { scrapeCompetitorProducts } from "@/lib/competitors/scrape";
import { consumeDiscoveryQuota } from "@/lib/discovery-quota";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/competitors/[competitorId]/discover
 * 
 * Runs discovery scan for a competitor store:
 * 1. Scrapes competitor product list
 * 2. Consumes discovery quota
 * 3. Saves competitor products to competitor_url_products with store_id and competitor_id
 * 4. Calls RPC build_match_candidates_for_competitor_store
 * 5. Updates competitor status to 'active' and last_sync_at
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await getOrCreateStore();

    // Load competitor
    const { data: competitor, error: competitorError } = await supabaseAdmin
      .from("competitors")
      .select("id, name, url, store_id, status")
      .eq("id", competitorId)
      .eq("store_id", store.id)
      .single();

    if (competitorError || !competitor) {
      console.error("Error loading competitor:", JSON.stringify(competitorError, null, 2));
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    // Update status to 'pending' (discovery in progress) - use only allowed DB values
    await supabaseAdmin
      .from("competitors")
      .update({ status: "pending" })
      .eq("id", competitorId);

    try {
      // Step 1: Scrape competitor catalog
      const scrapedProducts = await scrapeCompetitorProducts(competitor.url);

      if (scrapedProducts.length === 0) {
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "error",
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", competitorId);
        return NextResponse.json({
          error: "No products found on competitor store",
        }, { status: 400 });
      }

      // Step 2: Check and consume discovery quota
      const quotaResult = await consumeDiscoveryQuota(store.id, scrapedProducts.length);

      if (!quotaResult || !quotaResult.allowed) {
        const remaining = quotaResult?.remaining_products ?? 0;
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "error",
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", competitorId);
        return NextResponse.json({
          error: `Discovery quota exceeded. Remaining: ${remaining} products`,
          remaining,
        }, { status: 403 });
      }

      // Step 3: Save competitor products to competitor_url_products
      // CRITICAL: Must set store_id and competitor_id
      const now = new Date().toISOString();
      const competitorProductsToInsert = scrapedProducts.map((p) => ({
        store_id: store.id, // CRITICAL: Must be set
        competitor_id: competitorId, // CRITICAL: Must be set
        competitor_name: p.name,
        competitor_url: p.url,
        last_price: p.price,
        currency: "USD", // Default to USD (can be enhanced to detect from scraped data)
        last_checked_at: now,
        source: "store", // Mark as store-scraped
      }));

      const { data: insertedProducts, error: insertError } = await supabaseAdmin
        .from("competitor_url_products")
        .upsert(competitorProductsToInsert, {
          onConflict: "store_id,competitor_id,competitor_url",
          ignoreDuplicates: false,
        })
        .select("id");

      if (insertError) {
        console.error("Error inserting competitor products:", JSON.stringify(insertError, null, 2));
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "error",
            last_sync_at: now,
          })
          .eq("id", competitorId);
        return NextResponse.json(
          { error: "Failed to save competitor products" },
          { status: 500 }
        );
      }

      // Step 4: Call RPC build_match_candidates_for_competitor_store
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "build_match_candidates_for_competitor_store",
        {
          p_store_id: store.id,
          p_competitor_id: competitorId,
        }
      );

      if (rpcError) {
        console.error("Error calling build_match_candidates_for_competitor_store:", JSON.stringify(rpcError, null, 2));
        // Continue anyway - match candidates can be built later
      }

      // Step 5: Update competitor status to 'active' and set last_sync_at
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "active", // Use only allowed DB values ('pending' or 'active')
          last_sync_at: now,
        })
        .eq("id", competitorId);

      return NextResponse.json({
        success: true,
        productsFound: scrapedProducts.length,
        productsSaved: insertedProducts?.length || 0,
        quotaRemaining: quotaResult.remaining_products,
      });
    } catch (error: any) {
      console.error("Error in discovery scrape:", JSON.stringify(error, null, 2));
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "error",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", competitorId);
      return NextResponse.json(
        { error: error.message || "Failed to discover competitor products" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error in POST /api/competitors/[competitorId]/discover:", JSON.stringify(err, null, 2));
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
