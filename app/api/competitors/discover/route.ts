import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { scrapeCompetitorProducts } from "@/lib/competitors/scrape";
import { normalizeTitle } from "@/lib/competitors/title-normalization";

/**
 * POST /api/competitors/discover
 * 
 * Runs discovery scan for a competitor store:
 * 1. Scrapes competitor product list
 * 2. Consumes discovery quota
 * 3. Saves competitor products
 * 4. Creates match candidates using similarity
 */
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
    const { competitor_store_id } = body as { competitor_store_id: string };

    if (!competitor_store_id) {
      return NextResponse.json(
        { error: "Missing competitor_store_id" },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore();

    // Verify competitor store belongs to user's store
    const { data: competitorStore, error: competitorError } = await supabase
      .from("competitors")
      .select("id, name, url, store_id")
      .eq("id", competitor_store_id)
      .eq("store_id", store.id)
      .single();

    if (competitorError || !competitorStore) {
      return NextResponse.json(
        { error: "Competitor store not found" },
        { status: 404 }
      );
    }

    // Step 1: Scrape competitor products
    const scrapedProducts = await scrapeCompetitorProducts(competitorStore.url);

    if (scrapedProducts.length === 0) {
      return NextResponse.json(
        { error: "No products found on competitor store" },
        { status: 400 }
      );
    }

    // Step 2: Check and consume discovery quota
    const { data: quotaResult, error: quotaError } = await supabase.rpc(
      "consume_discovery_products",
      {
        p_store_id: store.id,
        p_amount: scrapedProducts.length,
      }
    );

    if (quotaError || !quotaResult || quotaResult.length === 0) {
      return NextResponse.json(
        { error: "Failed to check discovery quota" },
        { status: 500 }
      );
    }

    const quota = quotaResult[0];
    if (!quota.allowed) {
      // Partial scan if quota would be exceeded
      const allowedCount = quota.remaining_products;
      if (allowedCount <= 0) {
        return NextResponse.json(
          {
            error: "Discovery quota exceeded",
            remaining_products: quota.remaining_products,
            limit_products: quota.limit_products,
          },
          { status: 403 }
        );
      }

      // Truncate to remaining quota
      const truncatedProducts = scrapedProducts.slice(0, allowedCount);
      
      // Consume remaining quota
      await supabase.rpc("consume_discovery_products", {
        p_store_id: store.id,
        p_amount: allowedCount,
      });

      // Use truncated list
      const productsToProcess = truncatedProducts;
      const finalQuota = await supabase.rpc("consume_discovery_products", {
        p_store_id: store.id,
        p_amount: 0, // Just get current state
      });

      return NextResponse.json({
        success: true,
        discovered_count: productsToProcess.length,
        used_quota: finalQuota.data?.[0]?.used_products || 0,
        remaining_quota: finalQuota.data?.[0]?.remaining_products || 0,
        created_candidates_count: 0,
        warning: `Only ${allowedCount} products processed due to quota limit`,
      });
    }

    // Step 3: Upsert competitor products
    const competitorProductsToInsert = scrapedProducts.map((p) => {
      // Extract currency from price if available, or default to USD
      const currency = (p as any).currency || "USD";
      return {
        competitor_store_id: competitor_store_id,
        name: p.name,
        title_norm: normalizeTitle(p.name),
        url: p.url,
        price: p.price,
        currency: currency,
        external_id: p.external_id || null,
        last_seen_at: new Date().toISOString(),
      };
    });

    const { data: insertedProducts, error: insertError } = await supabase
      .from("competitor_products")
      .upsert(competitorProductsToInsert, {
        onConflict: "competitor_store_id,url",
        ignoreDuplicates: false,
      })
      .select("id, name, title_norm");

    if (insertError) {
      console.error("Error inserting competitor products:", insertError);
      return NextResponse.json(
        { error: "Failed to save competitor products" },
        { status: 500 }
      );
    }

    // Step 4: Build match candidates using trigram similarity
    const { data: myProducts, error: productsError } = await supabase
      .from("products")
      .select("id, name, title_norm")
      .eq("store_id", store.id)
      .eq("is_demo", false)
      .not("title_norm", "is", null);

    if (productsError) {
      console.error("Error loading products:", productsError);
    }

    const myProductsList = myProducts || [];
    const competitorProductsList = insertedProducts || [];

    // For each competitor product, find top 3 matches
    const candidatesToInsert: Array<{
      competitor_store_id: string;
      my_product_id: string;
      competitor_product_id: string;
      score: number;
    }> = [];

    for (const compProduct of competitorProductsList) {
      if (!compProduct.title_norm) continue;

      // Use trigram similarity to find best matches
      const { data: matches, error: matchError } = await supabase.rpc(
        "similarity_search",
        {
          search_text: compProduct.title_norm,
          match_threshold: 0.3, // 30% minimum similarity
          result_limit: 3,
        }
      );

      // Fallback: if RPC doesn't exist, use simple text matching
      if (matchError || !matches) {
        // Simple fallback: find products with similar title_norm
        for (const myProduct of myProductsList) {
          if (!myProduct.title_norm) continue;

          // Calculate simple similarity (Jaccard-like)
          const score = calculateSimpleSimilarity(
            compProduct.title_norm,
            myProduct.title_norm
          );

          if (score >= 60) {
            candidatesToInsert.push({
              competitor_store_id: competitor_store_id,
              my_product_id: myProduct.id,
              competitor_product_id: compProduct.id,
              score: Math.round(score * 100) / 100,
            });
          }
        }
      } else {
        // Use RPC results
        for (const match of matches) {
          candidatesToInsert.push({
            competitor_store_id: competitor_store_id,
            my_product_id: match.product_id,
            competitor_product_id: compProduct.id,
            score: Math.round(match.similarity * 100) / 100,
          });
        }
      }
    }

    // Insert match candidates (upsert to avoid duplicates)
    if (candidatesToInsert.length > 0) {
      const { error: candidatesError } = await supabase
        .from("competitor_match_candidates")
        .upsert(candidatesToInsert, {
          onConflict: "competitor_store_id,my_product_id,competitor_product_id",
          ignoreDuplicates: false,
        });

      if (candidatesError) {
        console.error("Error inserting match candidates:", candidatesError);
      }
    }

    return NextResponse.json({
      success: true,
      discovered_count: scrapedProducts.length,
      used_quota: quota.used_products,
      remaining_quota: quota.remaining_products,
      created_candidates_count: candidatesToInsert.length,
    });
  } catch (err: any) {
    console.error("Error in POST /api/competitors/discover:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * Simple similarity calculation (Jaccard-like)
 * Used as fallback if trigram similarity is not available
 */
function calculateSimpleSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.split(" ").filter((t) => t.length > 0));
  const tokens2 = new Set(str2.split(" ").filter((t) => t.length > 0));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++;
  }

  const union = tokens1.size + tokens2.size - intersection;
  return (intersection / union) * 100;
}

