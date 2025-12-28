import { createClient } from "@/lib/supabase/server";

/**
 * Count competitor URLs tracked for a store.
 * 
 * Uses the same logic as Competitors page "Added by URL" card.
 * Counts rows from competitor_url_products table for the store.
 * 
 * This matches the count shown in "Added by URL" section on Competitors page.
 */
export async function getCompetitorUrlsCount(storeId: string): Promise<number> {
  const supabase = await createClient();

  try {
    // Count directly from competitor_url_products table (same as Competitors page)
    const { count, error } = await supabase
      .from("competitor_url_products")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId);

    if (error) {
      console.error("Error counting competitor URLs:", error);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("Error in getCompetitorUrlsCount:", err);
    return 0;
  }
}

