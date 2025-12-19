import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateStore } from "@/lib/store";
import { scrapeProductPage } from "@/lib/competitors/scrapeProductPage";
import { getCompetitorLimit } from "@/lib/planLimits";

// Helper to ensure JSON response with proper headers
function jsonResponse(
  data: { error: string; code?: string; details?: Record<string, any>; received?: string } | { 
    ok: boolean; 
    warning?: string;
    competitorId?: string;
    competitorProductId?: string;
    productMatchId?: string;
  },
  status: number = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Redact sensitive fields for logging
function redactBody(body: any): any {
  if (!body) return body;
  const redacted = { ...body };
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[add-competitor-url] Request received");
  
  // Wrap entire handler in try/catch to ensure we always return JSON
  try {
    let productId: string;
    try {
      const resolvedParams = await params;
      productId = resolvedParams.id;
      console.log("[add-competitor-url] Product ID from params:", productId);
      
      if (!productId) {
        console.error("[add-competitor-url] validation failed: Missing productId in route params");
        return jsonResponse({ 
          error: "Product ID missing.", 
          code: "VALIDATION_ERROR",
          details: { field: "productId" }
        }, 400);
      }
    } catch (paramsError: any) {
      console.error("[add-competitor-url] Error parsing route params:", paramsError);
      return jsonResponse({ 
        error: paramsError?.message || "Invalid route parameters",
        code: "VALIDATION_ERROR"
      }, 400);
    }
    
    console.log("[add-competitor-url] Starting, productId:", productId);
    
    let supabase;
    try {
      supabase = await createClient();
    } catch (supabaseError: any) {
      console.error("[add-competitor-url] Error creating Supabase client:", supabaseError);
      return jsonResponse({ 
        error: supabaseError?.message || "Failed to initialize database connection",
        code: "SERVER_ERROR"
      }, 500);
    }

    // Auth check
    let user, userError;
    try {
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user;
      userError = authResult.error;
    } catch (authErr: any) {
      console.error("[add-competitor-url] Exception during auth check:", authErr);
      return jsonResponse({ 
        error: authErr?.message || "Authentication failed",
        code: "AUTH_ERROR"
      }, 401);
    }

    if (userError) {
      console.error("[add-competitor-url] Supabase auth error:", userError);
      return jsonResponse({ 
        error: userError.message || "Unauthorized",
        code: "AUTH_ERROR"
      }, 401);
    }

    if (!user) {
      console.error("[add-competitor-url] No user found in session");
      return jsonResponse({ error: "Unauthorized", code: "AUTH_ERROR" }, 401);
    }

    // Get user plan for per-product limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    
    const plan = profile?.plan || "STARTER";
    const maxCompetitorsPerProduct = getCompetitorLimit(plan);

    // Check Content-Type header
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("[add-competitor-url] Invalid Content-Type:", contentType);
      return jsonResponse({ 
        error: "Invalid request body. Expected JSON.",
        code: "BAD_REQUEST_BODY"
      }, 400);
    }

    // Parse request body with error handling
    let body: any;
    try {
      body = await req.json();
      console.log("[add-competitor-url] Received body:", redactBody(body));
    } catch (parseError: any) {
      console.error("[add-competitor-url] body parse error:", parseError);
      return jsonResponse({ 
        error: "Invalid request body. Expected JSON.",
        code: "BAD_REQUEST_BODY"
      }, 400);
    }

    // Accept both competitorUrl and legacy url for backward compatibility
    const competitorUrl = body.competitorUrl ?? body.url;

    if (!competitorUrl || typeof competitorUrl !== "string" || !competitorUrl.trim()) {
      console.error("[add-competitor-url] validation failed: Missing competitorUrl", { body: redactBody(body) });
      return jsonResponse({ 
        error: "competitorUrl is required",
        code: "VALIDATION_ERROR",
        details: { field: "competitorUrl" }
      }, 400);
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(competitorUrl.trim());
      if (!parsedUrl.protocol.startsWith("http")) {
        throw new Error("Invalid protocol");
      }
    } catch {
      console.error("[add-competitor-url] validation failed: Invalid URL format", { competitorUrl });
      return jsonResponse({ 
        error: "Invalid URL, include https://",
        code: "VALIDATION_ERROR",
        received: competitorUrl
      }, 400);
    }

    // Block Amazon URLs
    if (parsedUrl.hostname.toLowerCase().includes("amazon.")) {
      console.error("[add-competitor-url] validation failed: Amazon URL blocked", { competitorUrl });
      return jsonResponse({ 
        error: "Amazon URLs are not supported.",
        code: "VALIDATION_ERROR",
        details: { field: "competitorUrl", reason: "amazon_blocked" }
      }, 400);
    }

    let store;
    try {
      store = await getOrCreateStore();
      if (!store || !store.id) {
        console.error("[add-competitor-url] validation failed: Store ID missing");
        return jsonResponse({ 
          error: "Store ID missing.",
          code: "VALIDATION_ERROR",
          details: { field: "storeId" }
        }, 400);
      }
    } catch (storeError: any) {
      console.error("[add-competitor-url] Error getting or creating store:", storeError);
      return jsonResponse({
        error: storeError?.message || "Failed to get or create store",
        code: "SERVER_ERROR"
      }, 500);
    }
    
    console.log("[add-competitor-url] storeId:", store.id, "productId:", productId);

    // Enforce ownership: Verify store belongs to user
    if (store.owner_id !== user.id) {
      console.error("[add-competitor-url] Ownership violation: store.owner_id", store.owner_id, "!= user.id", user.id);
      return jsonResponse({
        error: "Unauthorized: Store does not belong to user",
        code: "FORBIDDEN"
      }, 403);
    }

    // Load product and verify it belongs to user's store
    let product, productError;
    try {
      const productResult = await supabase
        .from("products")
        .select("id, store_id")
        .eq("id", productId)
        .eq("store_id", store.id)
        .single();
      
      product = productResult.data;
      productError = productResult.error;
    } catch (productErr: any) {
      console.error("[add-competitor-url] Exception loading product:", productErr);
      return jsonResponse({ 
        error: productErr?.message || "Failed to load product",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (productError) {
      console.error("[add-competitor-url] Supabase error loading product:", productError);
      return jsonResponse({
        error: productError.message || "Product not found",
        code: "NOT_FOUND"
      }, 404);
    }

    if (!product) {
      console.error("[add-competitor-url] Product not found for productId:", productId, "storeId:", store.id);
      return jsonResponse({ 
        error: "Product not found",
        code: "NOT_FOUND"
      }, 404);
    }

    // Enforce ownership: Verify product belongs to the store
    if (product.store_id !== store.id) {
      console.error("[add-competitor-url] Ownership violation: product.store_id", product.store_id, "!= store.id", store.id);
      return jsonResponse({
        error: "Unauthorized: Product does not belong to store",
        code: "FORBIDDEN"
      }, 403);
    }

    // Extract and normalize domain from URL
    const hostname = parsedUrl.hostname;
    const domain = hostname.toLowerCase().replace(/^www\./, "");
    // Always use https:// for baseUrl to ensure consistency with unique index
    const competitorBaseUrl = `https://${domain}`;
    const competitorName = domain.split(".").slice(0, -1).join(".") || domain;

    // Find or create competitor grouped by domain (for "Added by URL")
    // Use find-or-create pattern to avoid duplicate key errors
    // Check by URL to match the unique index on (store_id, url)
    let competitorId: string | undefined;

    // First, try to find existing competitor by URL
    let existingCompetitor, findCompetitorError;
    try {
      const findResult = await supabaseAdmin
        .from("competitors")
        .select("id")
        .eq("store_id", store.id)
        .eq("url", competitorBaseUrl)
        .limit(1)
        .maybeSingle();
      
      existingCompetitor = findResult.data;
      findCompetitorError = findResult.error;
    } catch (findErr: any) {
      console.error("[add-competitor-url] Exception finding competitor:", findErr);
      return jsonResponse({ 
        error: findErr?.message || "Failed to check for existing competitor",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (findCompetitorError) {
      console.error("[add-competitor-url] Supabase error finding competitor:", findCompetitorError);
      return jsonResponse({
        error: findCompetitorError.message || "Failed to check for existing competitor",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (existingCompetitor) {
      competitorId = existingCompetitor.id;
      console.log("[add-competitor-url] Using existing competitor:", {
        id: competitorId,
        url: competitorBaseUrl,
        domain,
      });
    } else {
      // Create new "Added by URL" competitor (grouped by domain)
      // This route must be idempotent - handle duplicate key gracefully
      try {
        const insertResult = await supabaseAdmin
          .from("competitors")
          .insert({
            store_id: store.id,
            name: competitorName,
            url: competitorBaseUrl,
            domain: domain,
            source: "product_url",
            is_tracked: false,
          })
          .select("id")
          .single();
        
        if (insertResult.data) {
          competitorId = insertResult.data.id;
          console.log("[add-competitor-url] Inserted domain-grouped competitor:", {
            id: competitorId,
            name: competitorName,
            url: competitorBaseUrl,
            domain,
            source: "product_url",
            is_tracked: false,
            store_id: store.id,
          });
        } else if (insertResult.error) {
          // If unique constraint violation (23505), retry find
          if (insertResult.error.code === "23505" || insertResult.error.message?.includes("unique")) {
            console.warn("[add-competitor-url] Duplicate key error, retrying find:", insertResult.error);
            const retryResult = await supabaseAdmin
              .from("competitors")
              .select("id")
              .eq("store_id", store.id)
              .eq("url", competitorBaseUrl)
              .limit(1)
              .maybeSingle();
            
            if (retryResult.data) {
              competitorId = retryResult.data.id;
              console.log("[add-competitor-url] Found competitor after duplicate key error:", competitorId);
            } else {
              console.error("[add-competitor-url] Could not find competitor after duplicate key error");
              return jsonResponse({ 
                error: "Failed to create competitor store (duplicate key)",
                code: "SERVER_ERROR"
              }, 500);
            }
          } else {
            console.error("[add-competitor-url] Supabase error creating competitor:", insertResult.error);
            return jsonResponse({
              error: insertResult.error.message || "Failed to create competitor store",
              code: "SERVER_ERROR"
            }, 500);
          }
        }
      } catch (insertErr: any) {
        console.error("[add-competitor-url] Exception creating competitor:", insertErr);
        // If unique constraint violation, try to find the competitor again
        if (insertErr.code === "23505" || insertErr.message?.includes("unique")) {
          console.warn("[add-competitor-url] Duplicate key error in catch, retrying find:", insertErr);
          const retryResult = await supabaseAdmin
            .from("competitors")
            .select("id")
            .eq("store_id", store.id)
            .eq("url", competitorBaseUrl)
            .limit(1)
            .maybeSingle();
          
          if (retryResult.data) {
            competitorId = retryResult.data.id;
            console.log("[add-competitor-url] Found competitor after duplicate key error in catch:", competitorId);
          } else {
            console.error("[add-competitor-url] Could not find competitor after duplicate key error in catch");
            return jsonResponse({ 
              error: "Failed to create competitor store (duplicate key)",
              code: "SERVER_ERROR"
            }, 500);
          }
        } else {
          return jsonResponse({ 
            error: insertErr?.message || "Failed to create competitor store",
            code: "SERVER_ERROR"
          }, 500);
        }
      }

      if (!competitorId) {
        console.error("[add-competitor-url] Competitor insert returned no data and no retry found");
        return jsonResponse({ 
          error: "Failed to create competitor store",
          code: "SERVER_ERROR"
        }, 500);
      }
    }

    // Ensure competitorId is set before proceeding
    if (!competitorId) {
      return jsonResponse({
        error: "Failed to get or create competitor",
        code: "SERVER_ERROR"
      }, 500);
    }

    // Scrape product page
    const trimmedUrl = competitorUrl.trim();
    console.log("[add-competitor-url] Starting scrape for URL:", trimmedUrl);
    
    let scrapedData;
    try {
      scrapedData = await scrapeProductPage(trimmedUrl);
      console.log("[add-competitor-url] Scrape succeeded", {
        name: scrapedData.name,
        price: scrapedData.price,
        currency: scrapedData.currency,
      });
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorCode = errorMessage === "BOT_BLOCKED" ? "BOT_BLOCKED" : "SCRAPE_FAILED";
      
      console.error("[add-competitor-url] Scrape failed", {
        competitorUrl: trimmedUrl,
        message: errorMessage,
        code: errorCode,
        error: error,
        stack: error?.stack,
      });
      
      // Handle BOT_BLOCKED specifically
      if (errorMessage === "BOT_BLOCKED") {
        return jsonResponse({
          error: "This store blocks automated access for this URL. Try another URL or we'll retry later.",
          code: "BOT_BLOCKED",
          details: { competitorUrl: trimmedUrl }
        }, 422);
      }
      
      // Handle other scrape failures
      return jsonResponse({
        error: errorMessage || "Could not fetch product data from this URL. Please check the link.",
        code: errorCode,
        details: { 
          competitorUrl: trimmedUrl,
          reason: errorMessage || "unknown"
        }
      }, 422);
    }

    // Determine if price was found
    const hasPrice = scrapedData.price !== null && scrapedData.price > 0;
    const needsPrice = !hasPrice;
    
    if (needsPrice) {
      console.warn("[add-competitor-url] No valid price found, will create with pending status", { competitorUrl, scrapedData });
    }

    // Check per-product competitor limit (2/5/10 based on plan)
    // Note: This is per-product limit, NOT store limit - URL competitors don't count toward store limit
    let existingMatchCount = 0;
    try {
      const { count, error: countError } = await supabaseAdmin
        .from("product_matches")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId)
        .eq("store_id", store.id);
      
      if (countError) {
        console.error("[add-competitor-url] Error counting existing matches:", countError);
        return jsonResponse({
          error: "Failed to check competitor limit",
          code: "SERVER_ERROR"
        }, 500);
      }
      
      existingMatchCount = count || 0;
      console.log("[add-competitor-url] Existing competitor count:", existingMatchCount, "for product:", productId, "plan:", plan, "limit:", maxCompetitorsPerProduct);
    } catch (countErr: any) {
      console.error("[add-competitor-url] Exception counting existing matches:", countErr);
      return jsonResponse({
        error: "Failed to check competitor limit",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (existingMatchCount >= maxCompetitorsPerProduct) {
      console.warn("[add-competitor-url] Per-product competitor limit reached", {
        productId,
        storeId: store.id,
        currentCount: existingMatchCount,
        limit: maxCompetitorsPerProduct,
        plan
      });
      return jsonResponse({
        error: `Competitor limit reached for this product (max ${maxCompetitorsPerProduct}).`,
        code: "LIMIT_EXCEEDED",
        details: {
          currentCount: existingMatchCount,
          limit: maxCompetitorsPerProduct,
          productId,
          plan
        }
      }, 400);
    }

    // Upsert competitor product (even without price) to avoid duplicates
    // Use admin client to bypass RLS (ownership already verified above)
    // Upsert on unique key (competitor_id, url)
    let competitorProduct, cpError;
    try {
      const cpResult = await supabaseAdmin
        .from("competitor_products")
        .upsert({
          competitor_id: competitorId,
          url: competitorUrl.trim(),
          name: scrapedData.name,
          price: hasPrice ? scrapedData.price : null,
          currency: scrapedData.currency || "USD",
          raw: { sourceUrl: competitorUrl.trim(), needsPrice },
        }, {
          onConflict: "competitor_id,url",
          ignoreDuplicates: false, // Update existing row
        })
        .select("id")
        .single();
      
      competitorProduct = cpResult.data;
      cpError = cpResult.error;
    } catch (cpErr: any) {
      console.error("[add-competitor-url] Exception upserting competitor product:", cpErr);
      return jsonResponse({ 
        error: cpErr?.message || "Failed to create competitor product",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (cpError) {
      console.error("[add-competitor-url] Supabase error upserting competitor product:", cpError);
      return jsonResponse({
        error: cpError.message || "Failed to create competitor product",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (!competitorProduct) {
      console.error("[add-competitor-url] Competitor product upsert returned no data");
      return jsonResponse({ 
        error: "Failed to create competitor product",
        code: "SERVER_ERROR"
      }, 500);
    }

    console.log("[add-competitor-url] Upserted competitor_product:", {
      id: competitorProduct.id,
      name: scrapedData.name,
      price: hasPrice ? scrapedData.price : null,
      url: competitorUrl.trim(),
    });

    // Create product match using admin client (ownership already verified above)
    // Use "confirmed" status so it appears in UI immediately (even if price is missing)
    let productMatch, matchError;
    try {
      const matchResult = await supabaseAdmin
        .from("product_matches")
        .insert({
          store_id: store.id,
          product_id: productId,
          competitor_product_id: competitorProduct.id,
          similarity: 100, // User explicitly added it
          status: "confirmed", // Always use "confirmed" so it appears in UI
        })
        .select("id")
        .single();
      
      productMatch = matchResult.data;
      matchError = matchResult.error;
    } catch (matchErr: any) {
      console.error("[add-competitor-url] Exception creating product match:", matchErr);
      return jsonResponse({ 
        error: matchErr?.message || "Failed to create product match link",
        code: "SERVER_ERROR",
        details: { 
          competitorProductId: competitorProduct.id,
          productId,
          storeId: store.id
        }
      }, 500);
    }

    if (matchError) {
      console.error("[add-competitor-url] Supabase error creating product match:", matchError);
      return jsonResponse({
        error: matchError.message || "Failed to create product match link",
        code: "SERVER_ERROR",
        details: { 
          competitorProductId: competitorProduct.id,
          productId,
          storeId: store.id,
          error: matchError
        }
      }, 500);
    }

    if (!productMatch) {
      console.error("[add-competitor-url] Product match insert returned no data");
      return jsonResponse({ 
        error: "Failed to create product match link",
        code: "SERVER_ERROR"
      }, 500);
    }

    console.log("[add-competitor-url] Inserted product_match:", {
      id: productMatch.id,
      product_id: productId,
      competitor_product_id: competitorProduct.id,
      store_id: store.id,
      status: "confirmed",
    });

    console.log("[add-competitor-url] Success", { 
      needsPrice,
      competitorId,
      competitorProductId: competitorProduct.id,
      productMatchId: productMatch.id
    });
    
    // Return with warning if price couldn't be detected, include IDs for debugging
    const responseData: any = {
      ok: true,
      competitorId,
      competitorProductId: competitorProduct.id,
      productMatchId: productMatch.id,
    };
    
    if (needsPrice) {
      responseData.warning = "Price could not be detected yet. We'll retry during the next sync.";
    }
    
    return jsonResponse(responseData);
  } catch (err: any) {
    console.error("[add-competitor-url] Unexpected error:", {
      error: err,
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    });
    
    // Ensure we always return a proper error response
    const errorMessage = err?.message || err?.toString() || "An unexpected error occurred";
    return jsonResponse({ 
      error: errorMessage,
      code: "SERVER_ERROR"
    }, 500);
  }
}

