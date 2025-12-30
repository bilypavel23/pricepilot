import { createClient } from "@/lib/supabase/server";
import util from "node:util";

/**
 * Get the active store for a user (or first store if no active one)
 * If no store exists, automatically creates a default store
 */
export async function getActiveStore(userId: string) {
  const supabase = await createClient();

  // Get the first store for this user (or create one if none exists)
  const { data: existingStores, error: storeError } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (existingStores && existingStores.length > 0) {
    return existingStores[0];
  }

  // No store exists -> create default one
  const { data: inserted, error: insertError } = await supabase
    .from("stores")
    .insert({
      owner_id: userId,
      name: "My main store",
    })
    .select("id, name")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to create default store");
  }

  return inserted;
}

/**
 * Get match count for a competitor store
 * Uses RPC function count_matches_for_competitor_store (2-parameter version only)
 * 
 * @param storeId - The store ID (required)
 * @param competitorId - The competitor store ID to count matches for
 * @returns Number of confirmed matches (0 if none or on error)
 */
export async function getMatchCountForCompetitor(
  storeId: string,
  competitorId: string
): Promise<number> {
  // If storeId is missing, don't call RPC and return 0
  if (!storeId) {
    return 0;
  }

  if (!competitorId) {
    return 0;
  }

  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(competitorId)) {
    console.error("[getMatchCountForCompetitor] Invalid UUID format for competitorId:", {
      competitorId,
      type: typeof competitorId,
    });
    return 0;
  }

  try {
    const supabase = await createClient();

    // Always use 2-parameter version with correct parameter names
    const { data, error } = await supabase.rpc("count_matches_for_competitor_store", {
      p_competitor_id: competitorId,
      p_store_id: storeId,
    });

    if (error) {
      console.error("[RPC] count_matches_for_competitor_store FAILED", error);
      return 0;
    }

    return data ?? 0;
  } catch (error: any) {
    // Catch any unexpected errors (network, etc.)
    console.error("[getMatchCountForCompetitor] Unexpected error:", {
      context: `[getMatchCountForCompetitor] Unexpected error for competitor ${competitorId}`,
      competitorId,
      storeId,
      message: error?.message || "Unknown error",
      code: error?.code || "NO_CODE",
      details: error?.details || null,
      hint: error?.hint || null,
      status: error?.status || null,
    });
    
    // Fallback: return 0 without crashing
    return 0;
  }
}

