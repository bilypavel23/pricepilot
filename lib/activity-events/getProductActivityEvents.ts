import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "./getActivityEvents";

/**
 * Get activity events for a specific product.
 */
export async function getProductActivityEvents(
  storeId: string,
  productId: string,
  limit: number = 3
): Promise<ActivityEvent[]> {
  try {
    const supabase = await createClient();

    // Query activity events and filter by productId in meta
    // We need to fetch all events for the store and filter client-side
    // because Supabase JSONB filtering can be tricky
    const { data: allEvents, error } = await supabase
      .from("activity_events")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(limit * 10); // Fetch more to account for filtering

    // Null guard: if no error, process data and return early
    if (!error) {
      // Filter events where meta.productId matches
      const filteredEvents = (allEvents || [])
        .filter((event) => {
          if (!event.meta || typeof event.meta !== "object") return false;
          return (event.meta as any).productId === productId;
        })
        .slice(0, limit);
      return filteredEvents;
    }

    // Gracefully handle errors (error is non-null here)
    if (
      error.message?.includes("does not exist") ||
      error.code === "42P01"
    ) {
      return [];
    }
    console.warn("Failed to fetch product activity events:", error);
    return [];
  } catch (err: any) {
    console.warn("Exception fetching product activity events:", err);
    return [];
  }
}

