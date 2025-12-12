import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import { scrapeProductPage } from "@/lib/competitors/scrapeProductPage";

// Helper to ensure JSON response with proper headers
function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[API] Add competitor by URL - Request received");
  
  // Wrap entire handler in try/catch to ensure we always return JSON
  try {
    let productId: string;
    try {
      const resolvedParams = await params;
      productId = resolvedParams.id;
      console.log("[API] Product ID from params:", productId);
      
      if (!productId) {
        console.error("[API] Missing productId in route params");
        return jsonResponse({ error: "Product ID is required" }, 400);
      }
    } catch (paramsError: any) {
      console.error("[API] Error parsing route params:", paramsError);
      return jsonResponse({ 
        error: paramsError?.message || "Invalid route parameters" 
      }, 400);
    }
    
    console.log("[API] Add competitor by URL - Starting, productId:", productId);
    
    let supabase;
    try {
      supabase = await createClient();
    } catch (supabaseError: any) {
      console.error("[API] Error creating Supabase client:", supabaseError);
      return jsonResponse({ 
        error: supabaseError?.message || "Failed to initialize database connection" 
      }, 500);
    }

    // Auth check
    let user, userError;
    try {
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user;
      userError = authResult.error;
    } catch (authErr: any) {
      console.error("[API] Exception during auth check:", authErr);
      return jsonResponse({ 
        error: authErr?.message || "Authentication failed" 
      }, 401);
    }

    if (userError) {
      console.error("[API] Supabase auth error:", userError);
      return jsonResponse({ 
        error: userError.message || "Unauthorized" 
      }, 401);
    }

    if (!user) {
      console.error("[API] No user found in session");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Parse request body with error handling
    let body: any;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error("Error parsing request body:", parseError);
      return jsonResponse({ error: "Invalid request body. Expected JSON." }, 400);
    }

    const { url } = body as { url: string };

    if (!url || typeof url !== "string") {
      console.error("Missing or invalid URL in request body:", body);
      return jsonResponse({ error: "URL is required and must be a string" }, 400);
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return jsonResponse({ error: "Invalid URL format" }, 400);
    }

    // Block Amazon URLs
    if (parsedUrl.hostname.toLowerCase().includes("amazon.")) {
      return jsonResponse({ error: "Amazon URLs are not supported." }, 400);
    }

    let store;
    try {
      store = await getOrCreateStore();
      if (!store || !store.id) {
        console.error("Failed to get or create store");
        return jsonResponse({ error: "Failed to get or create store" }, 500);
      }
    } catch (storeError: any) {
      console.error("Error getting or creating store:", storeError);
      return jsonResponse(
        { error: storeError?.message || "Failed to get or create store" },
        500
      );
    }
    
    console.log("Add competitor by URL - storeId:", store.id, "productId:", productId);

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
      console.error("[API] Exception loading product:", productErr);
      return jsonResponse({ 
        error: productErr?.message || "Failed to load product" 
      }, 400);
    }

    if (productError) {
      console.error("[API] Supabase error loading product:", productError);
      return jsonResponse(
        { error: productError.message || "Product not found" },
        400
      );
    }

    if (!product) {
      console.error("[API] Product not found for productId:", productId, "storeId:", store.id);
      return jsonResponse({ error: "Product not found" }, 404);
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
      console.error("[API] Exception finding competitor:", findErr);
      return jsonResponse({ 
        error: findErr?.message || "Failed to check for existing competitor" 
      }, 400);
    }

    if (findCompetitorError) {
      console.error("[API] Supabase error finding competitor:", findCompetitorError);
      return jsonResponse(
        { error: findCompetitorError.message || "Failed to check for existing competitor" },
        400
      );
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
        console.error("[API] Exception creating competitor:", insertErr);
        return jsonResponse({ 
          error: insertErr?.message || "Failed to create competitor store" 
        }, 400);
      }

      if (competitorError) {
        console.error("[API] Supabase error creating competitor:", competitorError);
        return jsonResponse(
          { error: competitorError.message || "Failed to create competitor store" },
          400
        );
      }

      if (!newCompetitor) {
        console.error("[API] Competitor insert returned no data");
        return jsonResponse({ error: "Failed to create competitor store" }, 500);
      }

      competitorId = newCompetitor.id;
    }

    // Scrape product page
    let scrapedData;
    try {
      scrapedData = await scrapeProductPage(url);
    } catch (error: any) {
      console.error("Scraping error:", error);
      return jsonResponse(
        {
          error:
            "Could not fetch product data from this URL. Please check the link.",
        },
        400
      );
    }

    if (!scrapedData.price || scrapedData.price <= 0) {
      return jsonResponse(
        {
          error:
            "Could not extract a valid price from this URL. Please check the link.",
        },
        400
      );
    }

    // Insert competitor product
    let competitorProduct, cpError;
    try {
      const cpResult = await supabase
        .from("competitor_products")
        .insert({
          competitor_id: competitorId,
          name: scrapedData.name,
          price: scrapedData.price,
          currency: scrapedData.currency || "USD",
          url: url,
          raw: { sourceUrl: url },
        })
        .select("id")
        .single();
      
      competitorProduct = cpResult.data;
      cpError = cpResult.error;
    } catch (cpErr: any) {
      console.error("[API] Exception creating competitor product:", cpErr);
      return jsonResponse({ 
        error: cpErr?.message || "Failed to create competitor product" 
      }, 400);
    }

    if (cpError) {
      console.error("[API] Supabase error creating competitor product:", cpError);
      return jsonResponse(
        { error: cpError.message || "Failed to create competitor product" },
        400
      );
    }

    if (!competitorProduct) {
      console.error("[API] Competitor product insert returned no data");
      return jsonResponse({ error: "Failed to create competitor product" }, 500);
    }

    // Create product match
    try {
      const { error: matchError } = await supabase.from("product_matches").insert({
        store_id: store.id,
        product_id: productId,
        competitor_product_id: competitorProduct.id,
        similarity: 100, // User explicitly added it
        status: "confirmed",
      });

      if (matchError) {
        console.error("[API] Supabase error creating product match:", matchError);
        // Don't fail the request if match creation fails - product was added
        // But log it for debugging
      }
    } catch (matchErr: any) {
      console.error("[API] Exception creating product match:", matchErr);
      // Don't fail the request if match creation fails - product was added
      // But log it for debugging
    }

    console.log("Add competitor by URL - Success");
    return jsonResponse({ ok: true });
  } catch (err: any) {
    console.error("Unexpected error in add competitor by URL:", {
      error: err,
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    });
    
    // Ensure we always return a proper error response
    const errorMessage = err?.message || err?.toString() || "An unexpected error occurred";
    return jsonResponse({ error: errorMessage }, 500);
  }
}

