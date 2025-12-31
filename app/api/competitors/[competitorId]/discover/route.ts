import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { scrapeCompetitorProducts, ScrapingBlockedError, type ScrapedProduct } from "@/lib/scrapers/scrapeCompetitorProducts";
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
 * 6. Updates competitor status to 'ready' and last_sync_at
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
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "1";
    
    const supabase = await createClient();

    // Log competitorId param
    console.log("[discover] Starting discovery for competitorId param:", competitorId, "dryRun:", dryRun);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await getOrCreateStore();

    // CRITICAL: Validate competitor exists BEFORE scraping
    // Use supabaseAdmin to ensure we can verify existence even with RLS
    const { data: competitorCheck, error: competitorCheckError } = await supabaseAdmin
      .from("competitors")
      .select("id, name, url, store_id, status")
      .eq("id", competitorId)
      .eq("store_id", store.id)
      .single();

    if (competitorCheckError || !competitorCheck) {
      console.error("[discover] VALIDATE: Competitor not found in DB:", {
        stage: "validate",
        competitorIdParam: competitorId,
        storeId: store.id,
        error: competitorCheckError ? JSON.stringify(competitorCheckError, null, 2) : null,
      });
      
      // Set status to 'failed' if competitor record somehow doesn't exist
      try {
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "failed",
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", competitorId);
      } catch (updateErr) {
        // Ignore update error - competitor doesn't exist anyway
      }
      
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    const competitor = competitorCheck;

    // Log competitor.id from DB - this is the ID we'll use for FK fields
    console.log("[discover] VALIDATE: Competitor loaded from DB:", {
      stage: "validate",
      competitorIdParam: competitorId,
      competitorIdDb: competitor.id,
      competitorName: competitor.name,
      storeId: store.id,
      idsMatch: competitorId === competitor.id,
    });

    // Step 1: Scrape competitor catalog (always do this, even in dry-run)
    // Add timeout + retry wrapper for production resilience
    let scrapedProducts;
    let discoveredCount = 0;
    
    async function scrapeWithRetry(url: string, maxRetries = 2): Promise<ScrapedProduct[]> {
      const TIMEOUT_MS = 15000; // 15 second timeout
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
          
          console.log(`[discover] SCRAPE: Attempt ${attempt + 1}/${maxRetries + 1}`, {
            stage: "scrape",
            competitorId: competitor.id,
            url,
            attempt: attempt + 1,
          });
          
          // Wrap scraping in Promise with timeout
          const scrapePromise = scrapeCompetitorProducts(url);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              controller.abort();
              reject(new Error('Scraping timeout after 15s'));
            }, TIMEOUT_MS);
          });
          
          const result = await Promise.race([scrapePromise, timeoutPromise]);
          clearTimeout(timeoutId);
          return result;
        } catch (error: any) {
          const errorMessage = error?.message || String(error || "");
          const errorCode = error?.code || "";
          const isNetworkError = 
            errorMessage.includes("fetch failed") ||
            errorMessage.includes("UND_ERR_SOCKET") ||
            errorMessage.includes("ECONNRESET") ||
            errorMessage.includes("ETIMEDOUT") ||
            errorCode === "UND_ERR_SOCKET" ||
            errorCode === "ECONNRESET" ||
            errorCode === "ETIMEDOUT" ||
            errorMessage.includes("timeout");
          
          if (isNetworkError && attempt < maxRetries) {
            console.warn(`[discover] SCRAPE: Network error on attempt ${attempt + 1}, retrying...`, {
              stage: "scrape",
              competitorId: competitor.id,
              attempt: attempt + 1,
              error: errorMessage,
              errorCode,
            });
            // Wait a bit before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          
          // Not a network error or max retries reached
          throw error;
        }
      }
      
      throw new Error("Max retries exceeded");
    }
    
    try {
      scrapedProducts = await scrapeWithRetry(competitor.url);
      discoveredCount = scrapedProducts.length;
      
      console.log(`[discover] SCRAPE: Successfully scraped ${discoveredCount} products`, {
        stage: "scrape",
        competitorId: competitor.id,
        discoveredCount,
      });
    } catch (error: any) {
      // Handle blocked sites
      if (error instanceof ScrapingBlockedError || error?.message?.includes("blocks automated scraping")) {
        const now = new Date().toISOString();
        console.error("[discover] SCRAPE: Site blocked", {
          stage: "scrape",
          competitorId: competitor.id,
          error: error.message,
        });
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "blocked",
            last_sync_at: now,
            updated_at: now,
          })
          .eq("id", competitor.id);
        
        return NextResponse.json({
          ok: true,
          status: "blocked",
          message: "Site blocks automated scraping",
        }, { status: 200 });
      }
      
      // Other errors - set status to failed
      const now = new Date().toISOString();
      console.error("[discover] SCRAPE: Scraping failed", {
        stage: "scrape",
        competitorId: competitor.id,
        error: error?.message || String(error),
        errorCode: error?.code,
      });
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "failed",
          last_sync_at: now,
          updated_at: now,
        })
        .eq("id", competitor.id);
      
      // Re-throw to be caught by outer try/catch
      throw error;
    }

    // Dry-run: Return early with sample data
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        found: discoveredCount,
        sample: scrapedProducts.slice(0, 3).map(p => ({
          url: p.url,
          name: p.name,
          price: p.price,
          currency: p.currency,
        })),
      }, { status: 200 });
    }

    // Update status to 'processing' (discovery in progress) - only if not dry-run
    console.log("[discover] VALIDATE: Setting status to 'processing'", {
      stage: "validate",
      competitorId: competitor.id,
    });
    await supabaseAdmin
      .from("competitors")
      .update({ status: "processing" })
      .eq("id", competitor.id);

    try {
      const now = new Date().toISOString();

      // Early return if no products discovered
      if (discoveredCount === 0) {
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "empty",
            last_sync_at: now,
            updated_at: now,
          })
          .eq("id", competitor.id);
        return NextResponse.json({
          ok: true,
          status: "empty",
          discoveredCount: 0,
          upsertedCount: 0,
          message: "No products found on the competitor site.",
        }, { status: 200 });
      }

      // Step 2: Check and consume discovery quota
      const quotaResult = await consumeDiscoveryQuota(store.id, discoveredCount);

      if (!quotaResult || !quotaResult.allowed) {
        const remaining = quotaResult?.remaining_products ?? 0;
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "failed",
            last_sync_at: now,
            updated_at: now,
          })
          .eq("id", competitor.id);
        return NextResponse.json({
          ok: false,
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
            competitor_id: competitor.id, // CRITICAL: Use competitor.id from loaded record, not URL param
            competitor_name: competitorName,
            competitor_url: p.url,
            last_price: numericPrice, // Ensure numeric price (or null)
            currency: detectCurrency(p),
            last_checked_at: now,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      // Define price column name constant (DB uses 'last_price')
      const PRICE_COL = 'last_price' as const;
      
      // Log which competitor_id will be used for upsert
      console.log("[discover] UPSERT: Preparing to upsert competitor_store_products", {
        stage: "upsert",
        competitorIdParam: competitorId,
        competitorIdDb: competitor.id,
        competitorIdUsedForUpsert: competitor.id, // CRITICAL: Always use competitor.id from DB
        storeId: store.id,
        productsToInsert: competitorProductsToInsert.length,
        priceColumn: PRICE_COL,
        sampleProduct: competitorProductsToInsert[0] ? {
          competitor_id: competitorProductsToInsert[0].competitor_id,
          store_id: competitorProductsToInsert[0].store_id,
          competitor_url: competitorProductsToInsert[0].competitor_url,
          [PRICE_COL]: competitorProductsToInsert[0][PRICE_COL],
        } : null,
      });

      // Upsert using competitor.id from DB (NOT competitorId param)
      const { data: insertedProducts, error: insertError } = await supabaseAdmin
        .from("competitor_store_products")
        .upsert(competitorProductsToInsert, {
          onConflict: "competitor_id,competitor_url",
          ignoreDuplicates: false,
        })
        .select("id");

      if (insertError) {
        console.error("[discover] Error inserting competitor store products:", JSON.stringify({
          error: insertError,
          competitorIdParam: competitorId,
          competitorIdDb: competitor.id,
          competitorIdUsedForUpsert: competitor.id,
          storeId: store.id,
          url: competitor.url,
          productsCount: competitorProductsToInsert.length,
          sampleProduct: competitorProductsToInsert[0] ? {
            competitor_id: competitorProductsToInsert[0].competitor_id,
            store_id: competitorProductsToInsert[0].store_id,
            competitor_url: competitorProductsToInsert[0].competitor_url,
          } : null,
          // Log all competitor_ids in the insert array for debugging
          allCompetitorIds: competitorProductsToInsert.map(p => p.competitor_id),
        }, null, 2));
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "failed",
            last_sync_at: now,
            updated_at: now,
          })
          .eq("id", competitor.id);
        return NextResponse.json(
          { ok: false, error: "Failed to save competitor products" },
          { status: 500 }
        );
      }

      const upsertedCount = insertedProducts?.length || 0;
      console.log("[discover] Successfully upserted competitor_store_products:", {
        competitorIdParam: competitorId,
        competitorIdDb: competitor.id,
        competitorIdUsedForUpsert: competitor.id,
        insertedCount: upsertedCount,
      });

      // If upsertedCount === 0 (all products were filtered out), treat as empty result
      if (upsertedCount === 0) {
        await supabaseAdmin
          .from("competitors")
          .update({
            status: "empty",
            last_sync_at: now,
            updated_at: now,
          })
          .eq("id", competitor.id);
        return NextResponse.json({
          ok: true,
          status: "empty",
          discoveredCount,
          upsertedCount: 0,
          message: "No products found on the competitor site.",
        }, { status: 200 });
      }

      // Step 3.5: DEBUG - Log price population after insert
      // Check if scraper/insert is populating last_price correctly
      // Query: SELECT count(*) as total, count(*) FILTER (WHERE last_price IS NOT NULL) as with_price
      const { data: allRows, error: priceStatsError } = await supabaseAdmin
        .from("competitor_store_products")
        .select("last_price")
        .eq("store_id", store.id)
        .eq("competitor_id", competitor.id);
      
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
        .eq("competitor_id", competitor.id);
      
      console.log(`[discover] DEBUG: competitor_store_products count BEFORE build: ${stagingCount || 0} (error: ${countError ? JSON.stringify(countError) : 'none'})`);
      
      if (stagingCount === 0) {
        console.error(`[discover] ERROR: competitor_store_products is EMPTY before build call! store_id=${store.id}, competitor_id=${competitor.id}`);
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

      // Step 5: RPC - Call build_match_candidates_for_competitor_store
      // This RPC:
      // - Deletes old candidates for (store_id, competitor_id)
      // - Computes similarity between scraped products and store products using pg_trgm
      // - Inserts matched items directly into competitor_match_candidates (top-1 per competitor product)
      // - Returns inserted count
      // - Does NOT persist unmatched competitor products
      console.log("[discover] RPC: Calling build_match_candidates_for_competitor_store", {
        stage: "rpc",
        competitorId: competitor.id,
        storeId: store.id,
      });
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "build_match_candidates_for_competitor_store",
        {
          p_store_id: store.id,
          p_competitor_id: competitor.id,
        }
      );

      if (rpcError) {
        console.error("[discover] RPC: Error calling build_match_candidates_for_competitor_store", {
          stage: "rpc",
          competitorId: competitor.id,
          error: rpcError,
        });
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
          .eq("competitor_id", competitor.id);
        
        console.log(`[discover] DEBUG: competitor_match_candidates count AFTER build: ${candidatesCount || 0} (error: ${candidatesCountError ? JSON.stringify(candidatesCountError) : 'none'})`);
        
        if (insertedCount === 0 || candidatesCount === 0) {
          console.warn(`[discover] No candidates were inserted for store_id=${store.id}, competitor_id=${competitor.id}.`);
          console.warn(`[discover] RPC returned: ${insertedCount}, DB has: ${candidatesCount || 0} candidates`);
          
          // Dump sample rows from staging and products for debugging
          const { data: stagingSamples, error: stagingSamplesError } = await supabaseAdmin
            .from("competitor_store_products")
            .select("id, store_id, competitor_id, competitor_name, competitor_url, last_price, currency, created_at")
            .eq("store_id", store.id)
            .eq("competitor_id", competitor.id)
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
            console.log(`[discover] DEBUG: First staging row - competitor_id: ${actualCompetitorId}, expected: ${competitor.id}`);
            console.log(`[discover] DEBUG: First staging row - store_id: ${firstStaging.store_id}, expected: ${store.id}`);
            if (actualCompetitorId !== competitor.id) {
              console.error(`[discover] ERROR: competitor_id mismatch! Staging has: ${actualCompetitorId}, expected: ${competitor.id}`);
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

      // Step 7: FINALIZE - Update competitor status to 'ready' and set last_sync_at
      // Status 'ready' indicates scraping completed successfully with results
      console.log("[discover] FINALIZE: Updating competitor status to 'ready'", {
        stage: "finalize",
        competitorId: competitor.id,
        discoveredCount,
        upsertedCount,
      });
      
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "ready",
          last_sync_at: now,
          updated_at: now,
        })
        .eq("id", competitor.id);

      return NextResponse.json({
        ok: true,
        found: discoveredCount,
        upserted: upsertedCount,
        quotaRemaining: quotaResult.remaining_products,
      }, { status: 200 });
    } catch (error: any) {
      console.error("Error in discovery scrape:", JSON.stringify({
        message: error?.message || "Unknown error",
        code: error?.code || "NO_CODE",
        details: error?.details || null,
        hint: error?.hint || null,
        status: error?.status || null,
        stack: error?.stack || null,
      }, null, 2));
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("competitors")
        .update({
          status: "failed",
          last_sync_at: now,
          updated_at: now,
        })
        .eq("id", competitor.id);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to discover competitor products" },
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
