import { createClient } from "@/lib/supabase/server";

export interface ActivityEvent {
  id: string;
  store_id: string;
  type: string;
  title: string;
  meta: any;
  created_at: string;
}

/**
 * Get activity events for a store with pagination support.
 * @param storeId - The store ID
 * @param limit - Number of events to fetch (default: 10)
 * @param offset - Offset for pagination (default: 0)
 */
export async function getActivityEvents(
  storeId: string,
  limit: number = 10,
  offset: number = 0
): Promise<ActivityEvent[]> {
  try {
    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("activity_events")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    // Use range for pagination (range is inclusive on both ends)
    // If offset is 0, we can use limit for simplicity
    if (offset === 0) {
      query = query.limit(limit);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      // Log full error details for debugging
      const errorInfo = {
        message: error?.message || String(error),
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        storeId,
      };
      console.error("Failed to fetch activity events:", errorInfo);
      
      // Check error message/code for common issues
      const errorStr = JSON.stringify(errorInfo).toLowerCase();
      
      // If table doesn't exist yet, return empty array (graceful degradation)
      if (
        errorStr.includes("does not exist") ||
        errorStr.includes("42p01") ||
        errorStr.includes("relation") ||
        errorStr.includes("table") ||
        errorStr.includes("no such table")
      ) {
        console.warn("activity_events table does not exist yet. Run the migration first.");
        return [];
      }
      
      // If RLS policy error, also return empty array gracefully
      if (
        errorStr.includes("row-level security") ||
        errorStr.includes("rls") ||
        errorStr.includes("42501") ||
        errorStr.includes("permission denied")
      ) {
        console.warn("RLS policy issue with activity_events. Run the fix migration.");
        return [];
      }
      
      // For any other error, return empty array gracefully
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.error("Exception fetching activity events:", {
      err,
      message: err?.message,
      stack: err?.stack,
      storeId,
    });
    return [];
  }
}

