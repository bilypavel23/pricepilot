import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateStore } from "@/lib/store";
import { scrapeProductPage } from "@/lib/competitors/scrapeProductPage";
import { getCompetitorLimit } from "@/lib/planLimits";
import { normalizeTitle } from "@/lib/competitors/title-normalization";
import { checkCanWrite } from "@/lib/api-entitlements-check";

// Helper to ensure JSON response with proper headers
function jsonResponse(
  data: { error: string; code?: string; details?: Record<string, any>; received?: string } | { 
    ok: boolean; 
    warning?: string;
    competitorUrlProductId?: string;
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

    // Check if user can write (blocks expired trial)
    const writeCheck = await checkCanWrite(user.id);
    if (writeCheck) {
      return jsonResponse({
        error: "Trial ended. Upgrade to continue.",
        code: "TRIAL_ENDED",
      }, 403);
    }

    // Get user profile for entitlements
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const entitlements = getEntitlements(profile, user.created_at);

    const maxCompetitorsPerProduct = getCompetitorLimit(entitlements.effectivePlan, entitlements);

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

    // Extract competitor name from URL domain
    const hostname = parsedUrl.hostname;
    const domain = hostname.toLowerCase().replace(/^www\./, "");
    const competitorName = domain.split(".").slice(0, -1).join(".") || domain;

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
    // Count URL competitors from competitor_url_products table
    let existingUrlCompetitorCount = 0;
    try {
      const { count, error: countError } = await supabaseAdmin
        .from("competitor_url_products")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId)
        .eq("store_id", store.id);
      
      if (countError) {
        console.error("[add-competitor-url] Error counting existing URL competitors:", countError);
        return jsonResponse({
          error: "Failed to check competitor limit",
          code: "SERVER_ERROR"
        }, 500);
      }
      
      existingUrlCompetitorCount = count || 0;
      console.log("[add-competitor-url] Existing URL competitor count:", existingUrlCompetitorCount, "for product:", productId, "plan:", plan, "limit:", maxCompetitorsPerProduct);
    } catch (countErr: any) {
      console.error("[add-competitor-url] Exception counting existing URL competitors:", countErr);
      return jsonResponse({
        error: "Failed to check competitor limit",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (existingUrlCompetitorCount >= maxCompetitorsPerProduct) {
      console.warn("[add-competitor-url] Per-product competitor limit reached", {
        productId,
        storeId: store.id,
        currentCount: existingUrlCompetitorCount,
        limit: maxCompetitorsPerProduct,
        plan
      });
      return jsonResponse({
        error: `Competitor limit reached for this product (max ${maxCompetitorsPerProduct}).`,
        code: "LIMIT_EXCEEDED",
        details: {
          currentCount: existingUrlCompetitorCount,
          limit: maxCompetitorsPerProduct,
          productId,
          plan
        }
      }, 400);
    }

    // Upsert into competitor_url_products (exact URL per product)
    // Schema: store_id, product_id, competitor_url, competitor_name, last_price, currency, last_checked_at
    const productTitle = scrapedData.name || "Unknown Product";
    const now = new Date().toISOString();
    
    const competitorUrlPayload = {
      store_id: store.id,
      product_id: productId,
      competitor_url: competitorUrl.trim(),
      competitor_name: productTitle,
      last_price: hasPrice ? scrapedData.price : null,
      currency: scrapedData.currency || "USD",
      last_checked_at: now,
    };

    console.log("[add-competitor-url] Upserting competitor_url_product with payload:", {
      table: "competitor_url_products",
      payloadKeys: Object.keys(competitorUrlPayload),
      store_id: store.id,
      product_id: productId,
      competitor_url: competitorUrl.trim(),
      competitor_name: productTitle,
    });

    // Upsert into competitor_url_products with unique constraint on (store_id, product_id, competitor_url)
    // Payload must include: store_id, product_id, competitor_url, competitor_name, last_price, currency, last_checked_at
    const { data: upsertedUrlCompetitor, error: upsertUrlErr } = await supabaseAdmin
      .from("competitor_url_products")
      .upsert(competitorUrlPayload, { 
        onConflict: "store_id,product_id,competitor_url" 
      })
      .select("id, competitor_url, competitor_name, last_price, currency, last_checked_at")
      .maybeSingle();

    if (upsertUrlErr) {
      console.error("[add-competitor-url] Upsert error:", {
        table: "competitor_url_products",
        payloadKeys: Object.keys(competitorUrlPayload),
        error: upsertUrlErr,
        errorRaw: JSON.stringify(upsertUrlErr, null, 2),
        message: upsertUrlErr?.message,
        code: upsertUrlErr?.code,
        details: upsertUrlErr?.details,
        hint: upsertUrlErr?.hint,
      });
      return jsonResponse({
        error: "Failed to save competitor URL product",
        code: "SERVER_ERROR",
        details: {
          table: "competitor_url_products",
          upsertError: upsertUrlErr?.message,
        }
      }, 500);
    }

    if (!upsertedUrlCompetitor || !upsertedUrlCompetitor.id) {
      console.error("[add-competitor-url] Upsert succeeded but no data returned:", {
        upserted: upsertedUrlCompetitor,
        upsertErr: upsertUrlErr,
      });
      return jsonResponse({ 
        error: "Failed to create competitor URL product",
        code: "SERVER_ERROR",
        details: {
          table: "competitor_url_products",
        }
      }, 500);
    }

    const urlCompetitorId = upsertedUrlCompetitor.id;

    console.log("[add-competitor-url] Upsert succeeded:", {
      id: upsertedUrlCompetitor.id,
      competitor_url: upsertedUrlCompetitor.competitor_url,
      competitor_name: upsertedUrlCompetitor.competitor_name,
      last_price: upsertedUrlCompetitor.last_price,
      last_checked_at: upsertedUrlCompetitor.last_checked_at,
    });

    console.log("[add-competitor-url] Success", { 
      needsPrice,
      urlCompetitorId,
      productId,
    });
    
    // Return with warning if price couldn't be detected
    const responseData: any = {
      ok: true,
      competitorUrlProductId: urlCompetitorId,
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

