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
 * 3. Saves competitor products to competitor_store_products (VOLATILE staging only)
 * 4. Calls RPC build_match_candidates_for_competitor_store:
 *    - Computes similarity
 *    - Inserts matched items directly into competitor_match_candidates
 * 5. Keeps competitor_store_products for fallback builds (deletion disabled)
 * 6. Updates competitor status to 'active' and last_sync_at
 * 
 * CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
 * - All persistent logic must rely on: competitor_match_candidates and competitor_product_matches
 * - Never read from competitor_store_products for persistent data
 * - competitor_store_products is TEMP staging only - unmatched products are NOT persisted
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

    // Update status to 'processing' (discovery in progress)
    await supabaseAdmin
      .from("competitors")
      .update({ status: "processing" })
      .eq("id", competitorId);

    try {
      // Step 1: Scrape competitor catalog
      const scrapedProducts = await scrapeCompetitorProducts(competitor.url);

      if (scrapedProducts.length === 0) {
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "failed",
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
            status: "failed",
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", competitorId);
        return NextResponse.json({
          error: `Discovery quota exceeded. Remaining: ${remaining} products`,
          remaining,
        }, { status: 403 });
      }

      // Step 3: Save competitor products to competitor_store_products (VOLATILE staging only)
      // CRITICAL: competitor_store_products is VOLATILE and can be wiped anytime.
      // - Used only during similarity computation
      // - After RPC completes, competitor_store_products are kept for fallback builds (deletion disabled)
      // - All persistent logic must rely on competitor_match_candidates and competitor_product_matches
      // Only matched items are persisted in competitor_match_candidates.
      // CRITICAL: Must set store_id and competitor_id
      const now = new Date().toISOString();
      
      // Helper to detect currency from price/name
      const detectCurrency = (product: { name: string; price: number | null; url: string }): string => {
        // Check if price was scraped with currency symbol (would be in raw data)
        const priceStr = product.price?.toString() || "";
        const nameStr = product.name || "";
        const combined = `${priceStr} ${nameStr}`;
        
        if (combined.includes("$") || combined.includes("USD")) return "USD";
        if (combined.includes("£") || combined.includes("GBP")) return "GBP";
        if (combined.includes("€") || combined.includes("EUR")) return "EUR";
        if (combined.includes("Kč") || combined.includes("CZK")) return "CZK";
        
        return "USD"; // Default
      };
      
      // Ensure price is numeric and name is valid (not a price string)
      const pricePattern = /^\s*\$?\s*\d+(\.\d+)?\s*$/;
      
      const competitorProductsToInsert = scrapedProducts
        .map((p) => {
          // Guard: Validate that name doesn't look like a price
          let competitorName = p.name?.trim() || "";
          
          if (!competitorName || pricePattern.test(competitorName)) {
            // Name looks like a price or is empty - skip this product
            console.warn("[discover] Name looks like price or is empty, skipping", { url: p.url, name: competitorName, price: p.price });
            return null;
          }

          let numericPrice: number | null = null;
          
          if (p.price != null) {
            // If price is already a number, use it
            if (typeof p.price === 'number') {
              numericPrice = p.price > 0 ? p.price : null;
            } 
            // If price is a string, try to parse it
            else if (typeof p.price === 'string') {
              // Remove currency symbols and whitespace, then parse
              const priceStr: string = p.price;
              const cleaned = priceStr.replace(/[$£€,\s]/g, '').trim();
              const parsed = parseFloat(cleaned);
              numericPrice = !isNaN(parsed) && parsed > 0 ? parsed : null;
            }
          }
          
          // Log parsed values before insert
          console.log("[discover] Preparing product for insert", {
            url: p.url,
            name: competitorName,
            price: numericPrice,
            currency: detectCurrency(p),
          });
          
          return {
            store_id: store.id, // CRITICAL: Must be set
            competitor_id: competitorId, // CRITICAL: Must be set
            competitor_name: competitorName,
            competitor_url: p.url,
            last_price: numericPrice, // Ensure numeric price (or null)
            currency: detectCurrency(p),
            last_checked_at: now,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const { data: insertedProducts, error: insertError } = await supabaseAdmin
        .from("competitor_store_products")
        .upsert(competitorProductsToInsert, {
          onConflict: "competitor_id,competitor_url",
          ignoreDuplicates: false,
        })
        .select("id");

      if (insertError) {
        console.error("Error inserting competitor store products:", JSON.stringify(insertError, null, 2));
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "failed",
            last_sync_at: now,
          })
          .eq("id", competitorId);
        return NextResponse.json(
          { error: "Failed to save competitor products" },
          { status: 500 }
        );
      }

      // Step 3.5: DEBUG - Log price population after insert
      // Check if scraper/insert is populating last_price correctly
      // Query: SELECT count(*) as total, count(*) FILTER (WHERE last_price IS NOT NULL) as with_price
      const { data: allRows, error: priceStatsError } = await supabaseAdmin
        .from("competitor_store_products")
        .select("last_price")
        .eq("store_id", store.id)
        .eq("competitor_id", competitorId);
      
      if (priceStatsError) {
        console.error(`[discover] ERROR checking price stats:`, JSON.stringify(priceStatsError, null, 2));
      } else {
        const total = allRows?.length || 0;
        const with_price = allRows?.filter(r => r.last_price != null && r.last_price !== undefined).length || 0;
        
        console.log(`[discover] Price population stats after insert: total=${total}, with_price=${with_price}, without_price=${total - with_price}`);
        
        if (with_price === 0 && total > 0) {
          console.error(`[discover] ERROR: Scraper/insert is NOT populating last_price!`);
          console.error(`[discover] All ${total} rows have last_price = NULL. This means nothing can be copied forward.`);
          console.error(`[discover] Check scraper output - it may be returning price as string or not parsing correctly.`);
          
          // Log sample of what was inserted
          const samplePrices = competitorProductsToInsert.slice(0, 3).map(p => ({
            name: p.competitor_name,
            url: p.competitor_url,
            price: p.last_price,
            price_type: typeof p.last_price,
          }));
          console.error(`[discover] Sample inserted prices:`, JSON.stringify(samplePrices, null, 2));
          
          // Log sample of what was scraped
          const sampleScraped = scrapedProducts.slice(0, 3).map(p => ({
            name: p.name,
            url: p.url,
            price: p.price,
            price_type: typeof p.price,
          }));
          console.error(`[discover] Sample scraped prices:`, JSON.stringify(sampleScraped, null, 2));
        } else if (with_price < total) {
          console.warn(`[discover] WARNING: ${total - with_price} out of ${total} rows have last_price = NULL`);
        } else {
          console.log(`[discover] SUCCESS: All ${total} rows have last_price populated`);
        }
      }

      // Step 4: DEBUG - Check count of competitor_store_products BEFORE build call
      // This helps diagnose if deletion is happening prematurely or RLS is blocking
      const { count: stagingCount, error: countError } = await supabaseAdmin
        .from("competitor_store_products")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("competitor_id", competitorId);
      
      console.log(`[discover] DEBUG: competitor_store_products count BEFORE build: ${stagingCount || 0} (error: ${countError ? JSON.stringify(countError) : 'none'})`);
      
      if (stagingCount === 0) {
        console.error(`[discover] ERROR: competitor_store_products is EMPTY before build call! store_id=${store.id}, competitor_id=${competitorId}`);
        console.error(`[discover] This indicates either: 1) premature deletion, 2) RLS blocking, or 3) insert failed silently`);
      }

      // Step 4.5: DEBUG - Check count of products for this store
      // If 0 -> matching cannot happen. Ensure you imported products for this store.
      const { count: productsCount, error: productsCountError } = await supabaseAdmin
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("is_demo", false);
      
      console.log(`[discover] DEBUG: products count for store_id=${store.id}: ${productsCount || 0} (error: ${productsCountError ? JSON.stringify(productsCountError) : 'none'})`);
      
      if (productsCount === 0) {
        console.error(`[discover] ERROR: No products found for store_id=${store.id}! Matching cannot happen. Ensure you imported products for this store.`);
      }

      // Step 5: Call RPC build_match_candidates_for_competitor_store
      // This RPC:
      // - Deletes old candidates for (store_id, competitor_id)
      // - Computes similarity between scraped products and store products using pg_trgm
      // - Inserts matched items directly into competitor_match_candidates (top-1 per competitor product)
      // - Returns inserted count
      // - Does NOT persist unmatched competitor products
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
      } else {
        // Log the returned count from RPC
        const insertedCount = typeof rpcResult === 'number' ? rpcResult : rpcResult?.inserted_count || rpcResult?.count || 0;
        console.log(`[discover] build_match_candidates_for_competitor_store returned count: ${insertedCount}`);
        
        // Step 5.5: DEBUG - Check if candidates were actually inserted
        const { count: candidatesCount, error: candidatesCountError } = await supabaseAdmin
          .from("competitor_match_candidates")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("competitor_id", competitorId);
        
        console.log(`[discover] DEBUG: competitor_match_candidates count AFTER build: ${candidatesCount || 0} (error: ${candidatesCountError ? JSON.stringify(candidatesCountError) : 'none'})`);
        
        if (insertedCount === 0 || candidatesCount === 0) {
          console.warn(`[discover] No candidates were inserted for store_id=${store.id}, competitor_id=${competitorId}.`);
          console.warn(`[discover] RPC returned: ${insertedCount}, DB has: ${candidatesCount || 0} candidates`);
          
          // Dump sample rows from staging and products for debugging
          const { data: stagingSamples, error: stagingSamplesError } = await supabaseAdmin
            .from("competitor_store_products")
            .select("id, store_id, competitor_id, competitor_name, competitor_url, competitor_price, currency, created_at")
            .eq("store_id", store.id)
            .eq("competitor_id", competitorId)
            .order("created_at", { ascending: false })
            .limit(3);
          
          console.log(`[discover] DEBUG: Sample rows from competitor_store_products (limit 3):`, JSON.stringify(stagingSamples || [], null, 2));
          if (stagingSamplesError) {
            console.error(`[discover] ERROR fetching staging samples:`, JSON.stringify(stagingSamplesError, null, 2));
          }
          
          const { data: productsSamples, error: productsSamplesError } = await supabaseAdmin
            .from("products")
            .select("id, store_id, name, sku, price, is_demo, created_at")
            .eq("store_id", store.id)
            .eq("is_demo", false)
            .order("created_at", { ascending: false })
            .limit(3);
          
          console.log(`[discover] DEBUG: Sample rows from products (limit 3):`, JSON.stringify(productsSamples || [], null, 2));
          if (productsSamplesError) {
            console.error(`[discover] ERROR fetching products samples:`, JSON.stringify(productsSamplesError, null, 2));
          }
          
          // Verify competitor_id consistency
          if (stagingSamples && stagingSamples.length > 0) {
            const firstStaging = stagingSamples[0] as any;
            const actualCompetitorId = firstStaging.competitor_id || firstStaging.competitor_store_id;
            console.log(`[discover] DEBUG: First staging row - competitor_id: ${actualCompetitorId}, expected: ${competitorId}`);
            console.log(`[discover] DEBUG: First staging row - store_id: ${firstStaging.store_id}, expected: ${store.id}`);
            if (actualCompetitorId !== competitorId) {
              console.error(`[discover] ERROR: competitor_id mismatch! Staging has: ${actualCompetitorId}, expected: ${competitorId}`);
              console.error(`[discover] ERROR: Check if table uses competitor_store_id instead of competitor_id`);
            }
            if (firstStaging.store_id !== store.id) {
              console.error(`[discover] ERROR: store_id mismatch! Staging has: ${firstStaging.store_id}, expected: ${store.id}`);
            }
          }
        }
        
        // NOTE: Deletion of competitor_store_products is DISABLED for now.
        // The get_competitor_products_for_store_matches RPC will handle fallback build automatically.
        // Step 6: Deletion removed - competitor_store_products is kept for fallback builds
        // const { error: deleteError } = await supabaseAdmin
        //   .from("competitor_store_products")
        //   .delete()
        //   .eq("store_id", store.id)
        //   .eq("competitor_id", competitorId);
      }

      // Step 7: Update competitor status to 'ready' and set last_sync_at
      // Status 'ready' indicates scraping is complete and matches are available for review
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "ready",
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
      console.error("Error in discovery scrape:", JSON.stringify({
        message: error?.message || "Unknown error",
        code: error?.code || "NO_CODE",
        details: error?.details || null,
        hint: error?.hint || null,
        status: error?.status || null,
        stack: error?.stack || null,
      }, null, 2));
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "failed",
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
