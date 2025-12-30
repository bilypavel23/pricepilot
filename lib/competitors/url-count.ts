import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Structured error logging for Supabase errors
 */
function logSupabaseError(context: string, error: any) {
  const errorDetails = {
    context,
    message: error?.message || "Unknown error",
    code: error?.code || "NO_CODE",
    details: error?.details || null,
    hint: error?.hint || null,
    status: error?.status || null,
    raw: error,
  };

  console.error(`[${context}]`, JSON.stringify(errorDetails, null, 2));
}

/**
 * Result type for URL competitor products count
 */
export type UrlCompetitorProductsCountResult = {
  count: number;
  error?: string;
};

/**
 * Get count of URL-based competitor products for a store
 * 
 * This counts competitor_url_products for the store (exact URLs per product).
 * 
 * @param supabase - Supabase client
 * @param storeId - Store ID (must be valid UUID)
 * @returns Object with count and optional error message
 */
export async function getUrlCompetitorProductsCount(
  supabase: SupabaseClient,
  storeId: string | undefined
): Promise<UrlCompetitorProductsCountResult> {
  // Safety check: if storeId is missing, return error result
  if (!storeId) {
    return {
      count: 0,
      error: "Missing storeId",
    };
  }

  try {
    // Count directly from competitor_url_products table
    const { count, error } = await supabase
      .from("competitor_url_products")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId);

    if (error) {
      // Improved error logging with message, details, hint, code
      const errorStatus = (error as any)?.status ?? null;
      const errorDetails = {
        context: "getUrlCompetitorProductsCount: count query failed",
        message: error.message || "Unknown error",
        code: error.code || "NO_CODE",
        details: error.details || null,
        hint: error.hint || null,
        status: errorStatus,
        raw: error,
      };
      console.error("[getUrlCompetitorProductsCount]", JSON.stringify(errorDetails, null, 2));

      return {
        count: 0,
        error: error.message || "Failed to count URL competitor products",
      };
    }

    // Return count (default to 0 if null/undefined)
    return {
      count: count ?? 0,
    };
  } catch (error: any) {
    // Catch any unexpected errors (network, etc.)
    logSupabaseError("getUrlCompetitorProductsCount: unexpected error", error);
    return {
      count: 0,
      error: error?.message || "Unexpected error occurred",
    };
  }
}

