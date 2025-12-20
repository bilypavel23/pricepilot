import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { scrapeCompetitorProducts } from "@/lib/competitors/scrape";
import { normalizeTitle } from "@/lib/competitors/title-normalization";
import { consumeDiscoveryQuota } from "@/lib/discovery-quota";

/**
 * POST /api/competitors/[competitorId]/discover
 * 
 * Runs discovery scan for a competitor store:
 * 1. Scrapes competitor product list
 * 2. Consumes discovery quota
 * 3. Saves competitor products with name_norm
 * 4. Creates match candidates using trigram similarity
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
    const { data: competitor, error: competitorError } = await supabase
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

    // Update status to pending (discovery in progress)
    await supabase
      .from("competitors")
      .update({ status: "pending" })
      .eq("id", competitorId);

    try {
      // Step 1: Scrape competitor catalog
      const scrapedProducts = await scrapeCompetitorProducts(competitor.url);

      if (scrapedProducts.length === 0) {
        await supabase
          .from("competitors")
          .update({
            status: "error",
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
        await supabase
          .from("competitors")
          .update({
            status: "error",
          })
          .eq("id", competitorId);
        return NextResponse.json({
          error: `Discovery quota exceeded. Remaining: ${remaining} products`,
          remaining,
        }, { status: 403 });
      }

      // Step 3: Save competitor products with title_norm
      const competitorProductsToInsert = scrapedProducts.map((p) => ({
        competitor_id: competitorId,
        title: p.name, // Use 'title' column, not 'name'
        title_norm: normalizeTitle(p.name),
        url: p.url,
        price: p.price,
        currency: "USD", // TODO: detect currency from scraped data
        external_id: p.external_id || null,
        last_seen_at: new Date().toISOString(),
      }));

      const { data: insertedProducts, error: insertError } = await supabase
        .from("competitor_products")
        .upsert(competitorProductsToInsert, {
          onConflict: "competitor_id,url",
          ignoreDuplicates: false,
        })
        .select("id, title, title_norm");

      if (insertError) {
        console.error("Error inserting competitor products:", JSON.stringify(insertError, null, 2));
        await supabase
          .from("competitors")
          .update({
            status: "error",
          })
          .eq("id", competitorId);
        return NextResponse.json(
          { error: "Failed to save competitor products" },
          { status: 500 }
        );
      }

      // Step 4: Build match candidates using trigram similarity
      const { data: myProducts, error: productsError } = await supabase
        .from("products")
        .select("id, name, name_norm")
        .eq("store_id", store.id)
        .eq("is_demo", false)
        .not("name_norm", "is", null);

      if (productsError) {
        console.error("Error loading products:", JSON.stringify(productsError, null, 2));
      }

      const myProductsList = myProducts || [];
      const competitorProductsList = insertedProducts || [];

      // For each competitor product, find top matches using DB function
      const candidatesToInsert: Array<{
        competitor_id: string;
        my_product_id: string;
        competitor_product_id: string;
        score: number;
      }> = [];

      for (const compProduct of competitorProductsList) {
        if (!compProduct.title_norm) continue;

        // Use DB function for similarity search
        const { data: matches, error: matchError } = await supabase.rpc(
          "find_similar_products",
          {
            p_competitor_name_norm: compProduct.title_norm,
            p_store_id: store.id,
            p_limit: 3,
          }
        );

        if (matchError) {
          console.error("Error finding similar products:", JSON.stringify(matchError, null, 2));
          // Fallback to simple matching
          continue;
        }

        if (matches && matches.length > 0) {
          for (const match of matches) {
            if (match.similarity >= 60) {
              candidatesToInsert.push({
                competitor_id: competitorId,
                my_product_id: match.product_id,
                competitor_product_id: compProduct.id,
                score: Math.round(match.similarity * 100) / 100,
              });
            }
          }
        }
      }

      // Insert match candidates (upsert to avoid duplicates)
      if (candidatesToInsert.length > 0) {
        const { error: candidatesError } = await supabase
          .from("competitor_match_candidates")
          .upsert(candidatesToInsert, {
            onConflict: "competitor_id,my_product_id,competitor_product_id",
            ignoreDuplicates: false,
          });

        if (candidatesError) {
          console.error("Error inserting match candidates:", JSON.stringify(candidatesError, null, 2));
        }
      }

      // Step 5: Keep status as 'pending' until matches are confirmed
      // Status will be set to 'active' when matches are confirmed
      // No status update needed here

      return NextResponse.json({
        success: true,
        productsFound: scrapedProducts.length,
        productsSaved: insertedProducts?.length || 0,
        matchesCreated: candidatesToInsert.length,
        quotaRemaining: quotaResult.remaining_products,
      });
    } catch (error: any) {
      console.error("Error in discovery scrape:", JSON.stringify(error, null, 2));
      await supabase
        .from("competitors")
        .update({
          status: "error",
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
