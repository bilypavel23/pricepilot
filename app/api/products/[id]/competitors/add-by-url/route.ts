import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { scrapeProductPage } from "@/lib/competitors/scrapeProductPage";

// Helper to ensure JSON response with proper headers
function jsonResponse(
  data: { error: string; code?: string; details?: Record<string, any>; received?: string } | { ok: boolean; warning?: string },
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

    // Extract hostname from URL
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    const competitorBaseUrl = `${parsedUrl.protocol}//${hostname}`;

    // Find or create competitor store
    let competitorId: string;

    // Try to find existing competitor by URL pattern
    // Check if URL contains the hostname or matches the base URL
    let existingCompetitors, findCompetitorError;
    try {
      const findResult = await supabase
        .from("competitors")
        .select("id")
        .eq("store_id", store.id)
        .ilike("url", `%${hostname}%`)
        .limit(1)
        .maybeSingle();
      
      existingCompetitors = findResult.data;
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

    if (existingCompetitors) {
      competitorId = existingCompetitors.id;
    } else {
      // Create new competitor
      const competitorName = hostname
        .split(".")
        .slice(0, -1)
        .join(".")
        .replace(/^www\./, "") || hostname;

      let newCompetitor, competitorError;
      try {
        const insertResult = await supabase
          .from("competitors")
          .insert({
            store_id: store.id,
            name: competitorName,
            url: competitorBaseUrl,
          })
          .select("id")
          .single();
        
        newCompetitor = insertResult.data;
        competitorError = insertResult.error;
      } catch (insertErr: any) {
        console.error("[add-competitor-url] Exception creating competitor:", insertErr);
        return jsonResponse({ 
          error: insertErr?.message || "Failed to create competitor store",
          code: "SERVER_ERROR"
        }, 500);
      }

      if (competitorError) {
        console.error("[add-competitor-url] Supabase error creating competitor:", competitorError);
        return jsonResponse({
          error: competitorError.message || "Failed to create competitor store",
          code: "SERVER_ERROR"
        }, 500);
      }

      if (!newCompetitor) {
        console.error("[add-competitor-url] Competitor insert returned no data");
        return jsonResponse({ 
          error: "Failed to create competitor store",
          code: "SERVER_ERROR"
        }, 500);
      }

      competitorId = newCompetitor.id;
    }

    // Scrape product page
    let scrapedData;
    try {
      scrapedData = await scrapeProductPage(competitorUrl.trim());
    } catch (error: any) {
      console.error("[add-competitor-url] Scraping error:", error);
      
      // Handle BOT_BLOCKED specifically
      if (error.message === "BOT_BLOCKED") {
        return jsonResponse({
          error: "This store blocks automated access for this URL. Try another URL or we'll retry later.",
          code: "BOT_BLOCKED"
        }, 422);
      }
      
      return jsonResponse({
        error: "Could not fetch product data from this URL. Please check the link.",
        code: "SCRAPE_ERROR",
        details: { competitorUrl: competitorUrl.trim() }
      }, 400);
    }

    // Determine if price was found
    const hasPrice = scrapedData.price !== null && scrapedData.price > 0;
    const needsPrice = !hasPrice;
    
    if (needsPrice) {
      console.warn("[add-competitor-url] No valid price found, will create with pending status", { competitorUrl, scrapedData });
    }

    // Insert competitor product (even without price)
    let competitorProduct, cpError;
    try {
      const cpResult = await supabase
        .from("competitor_products")
        .insert({
          competitor_id: competitorId,
          name: scrapedData.name,
          price: hasPrice ? scrapedData.price : null,
          currency: scrapedData.currency || "USD",
          url: competitorUrl.trim(),
          raw: { sourceUrl: competitorUrl.trim(), needsPrice },
        })
        .select("id")
        .single();
      
      competitorProduct = cpResult.data;
      cpError = cpResult.error;
    } catch (cpErr: any) {
      console.error("[add-competitor-url] Exception creating competitor product:", cpErr);
      return jsonResponse({ 
        error: cpErr?.message || "Failed to create competitor product",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (cpError) {
      console.error("[add-competitor-url] Supabase error creating competitor product:", cpError);
      return jsonResponse({
        error: cpError.message || "Failed to create competitor product",
        code: "SERVER_ERROR"
      }, 500);
    }

    if (!competitorProduct) {
      console.error("[add-competitor-url] Competitor product insert returned no data");
      return jsonResponse({ 
        error: "Failed to create competitor product",
        code: "SERVER_ERROR"
      }, 500);
    }

    // Create product match
    try {
      const { error: matchError } = await supabase.from("product_matches").insert({
        store_id: store.id,
        product_id: productId,
        competitor_product_id: competitorProduct.id,
        similarity: 100, // User explicitly added it
        status: needsPrice ? "pending" : "confirmed",
      });

      if (matchError) {
        console.error("[add-competitor-url] Supabase error creating product match:", matchError);
        // Don't fail the request if match creation fails - product was added
      }
    } catch (matchErr: any) {
      console.error("[add-competitor-url] Exception creating product match:", matchErr);
      // Don't fail the request if match creation fails - product was added
    }

    console.log("[add-competitor-url] Success", { needsPrice });
    
    // Return with warning if price couldn't be detected
    if (needsPrice) {
      return jsonResponse({ 
        ok: true, 
        warning: "Price could not be detected yet. We'll retry during the next sync."
      });
    }
    
    return jsonResponse({ ok: true });
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

