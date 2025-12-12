import { createClient } from "@/lib/supabase/server";

export type ActivityEventType = "price_updated" | "products_sync" | "competitor_sync";

export interface ActivityEventMeta {
  [key: string]: any;
}

/**
 * Create an activity event in the database.
 * This should be called from server-side code (API routes, server components).
 */
export async function createActivityEvent(
  storeId: string,
  type: ActivityEventType,
  title: string,
  meta?: ActivityEventMeta
): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("activity_events").insert({
      store_id: storeId,
      type,
      title,
      meta: meta || null,
    });

    if (error) {
      console.error("Failed to create activity event:", error);
      // If table doesn't exist yet, just log and continue (graceful degradation)
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        console.warn("activity_events table does not exist yet. Run the migration first.");
        return;
      }
      // Don't throw - activity events are non-critical
    }
  } catch (err) {
    console.error("Exception creating activity event:", err);
    // Don't throw - activity events are non-critical
  }
}

