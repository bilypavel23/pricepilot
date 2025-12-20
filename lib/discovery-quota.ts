import { createClient } from "@/lib/supabase/server";

export type DiscoveryQuota = {
  store_id: string;
  period_start: string; // ISO date string (first day of month)
  used: number;
  limit_amount: number;
  remaining: number;
};

/**
 * Discovery quota limits per plan
 */
const PLAN_DISCOVERY_LIMITS: Record<string, number> = {
  starter: 2000,
  pro: 6000,
  scale: 8000,
};

/**
 * Get first day of current month in UTC as ISO date string (YYYY-MM-DD)
 */
function monthStartISODate(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return x.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Normalize plan string to planKey ("starter" | "pro" | "scale")
 */
function normalizePlanKey(plan: string | null | undefined): "starter" | "pro" | "scale" {
  if (!plan) return "starter";
  
  const normalized = plan.toLowerCase().trim();
  
  if (normalized === "starter" || normalized === "basic" || normalized === "free_demo" || normalized === "demo" || normalized === "free") {
    return "starter";
  }
  if (normalized === "pro" || normalized === "professional") {
    return "pro";
  }
  if (normalized === "scale" || normalized === "ultra" || normalized === "scal") {
    return "scale";
  }
  
  // Default to starter
  return "starter";
}

/**
 * Get or create discovery quota for a store (current month)
 * Never throws PGRST116 error - uses .maybeSingle() for initial read
 * 
 * @param storeId - Store ID
 * @param plan - Plan string (will be normalized to "starter" | "pro" | "scale")
 * @returns DiscoveryQuota or null if storeId is missing
 */
export async function getDiscoveryQuota(
  storeId: string,
  plan?: string | null
): Promise<DiscoveryQuota | null> {
  if (!storeId) {
    return null;
  }

  const supabase = await createClient();
  const period_start = monthStartISODate();
  const planKey = normalizePlanKey(plan);
  const limit_products = PLAN_DISCOVERY_LIMITS[planKey] ?? 2000;

  // 1) Try to read existing row using .maybeSingle() (never throws PGRST116)
  const { data: existing, error: readErr } = await supabase
    .from("competitor_discovery_quota")
    .select("store_id, period_start, limit_products, used_products")
    .eq("store_id", storeId)
    .eq("period_start", period_start)
    .maybeSingle();

  if (readErr) {
    console.error("Error getting discovery quota:", JSON.stringify(readErr, null, 2));
  }

  // If row exists, return it
  if (existing) {
    return {
      store_id: existing.store_id,
      period_start: existing.period_start,
      used: existing.used_products || 0,
      limit_amount: existing.limit_products || limit_products,
      remaining: (existing.limit_products || limit_products) - (existing.used_products || 0),
    };
  }

  // 2) Row doesn't exist - create it via upsert
  const { error: upsertErr } = await supabase
    .from("competitor_discovery_quota")
    .upsert(
      {
        store_id: storeId,
        period_start,
        limit_products,
        used_products: 0,
      },
      { onConflict: "store_id,period_start" }
    );

  if (upsertErr) {
    console.error("Error ensuring discovery quota:", JSON.stringify(upsertErr, null, 2));
    // Return safe default object
    return {
      store_id: storeId,
      period_start,
      used: 0,
      limit_amount: limit_products,
      remaining: limit_products,
    };
  }

  // 3) Read again (now it must exist, so .single() is safe)
  const { data: created, error: read2Err } = await supabase
    .from("competitor_discovery_quota")
    .select("store_id, period_start, limit_products, used_products")
    .eq("store_id", storeId)
    .eq("period_start", period_start)
    .single();

  if (read2Err) {
    console.error("Error reading ensured discovery quota:", JSON.stringify(read2Err, null, 2));
    // Return safe default object
    return {
      store_id: storeId,
      period_start,
      used: 0,
      limit_amount: limit_products,
      remaining: limit_products,
    };
  }

  if (!created) {
    // This shouldn't happen, but handle it safely
    return {
      store_id: storeId,
      period_start,
      used: 0,
      limit_amount: limit_products,
      remaining: limit_products,
    };
  }

  return {
    store_id: created.store_id,
    period_start: created.period_start,
    used: created.used_products || 0,
    limit_amount: created.limit_products || limit_products,
    remaining: (created.limit_products || limit_products) - (created.used_products || 0),
  };
}

/**
 * Consume discovery quota (returns success status and remaining quota)
 */
export async function consumeDiscoveryQuota(
  storeId: string,
  amount: number
): Promise<{
  allowed: boolean;
  remaining_products: number;
  limit_products: number;
  used_products: number;
} | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('consume_discovery_products', {
    p_store_id: storeId,
    p_amount: amount,
  });
  
  if (error) {
    console.error('Error consuming discovery quota:', JSON.stringify(error, null, 2));
    return null;
  }
  
  if (!data || data.length === 0) {
    return null;
  }
  
  return data[0];
}

