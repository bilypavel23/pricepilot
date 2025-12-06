import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Get the active store for a user (or first store if no active one)
 * If no store exists, automatically creates a default store
 */
export async function getActiveStore(userId: string) {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

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
 * Get match count for a competitor
 */
export async function getMatchCountForCompetitor(competitorId: string): Promise<number> {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // Try to count matches directly if product_matches has competitor_id
  const { count: directCount, error: directError } = await supabase
    .from("product_matches")
    .select("*", { count: "exact", head: true })
    .eq("competitor_id", competitorId);

  if (!directError && directCount !== null) {
    return directCount;
  }

  // Fallback: count via competitor_products
  const { data: competitorProducts, error: productsError } = await supabase
    .from("competitor_products")
    .select("id")
    .eq("competitor_id", competitorId);

  if (productsError || !competitorProducts || competitorProducts.length === 0) {
    return 0;
  }

  const competitorProductIds = competitorProducts.map((cp) => cp.id);

  const { count: matchCount, error: matchError } = await supabase
    .from("product_matches")
    .select("*", { count: "exact", head: true })
    .in("competitor_product_id", competitorProductIds);

  if (matchError) {
    console.error("Error counting matches:", matchError);
    return 0;
  }

  return matchCount || 0;
}

