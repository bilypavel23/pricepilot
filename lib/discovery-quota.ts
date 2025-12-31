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
 * Get discovery limit from entitlements
 * If profile is provided, use entitlements; otherwise normalize plan
 */
function getDiscoveryLimit(
  profile?: any,
  userCreatedAt?: string | Date,
  plan?: string | null
): number {
  // If profile is provided, use entitlements helper
  if (profile) {
    // Use dynamic import to avoid circular dependencies
    try {
      const { getEntitlements } = require("./billing/entitlements");
      const entitlements = getEntitlements(profile, userCreatedAt);
      return entitlements.discoveryMonthlyLimit;
    } catch (e) {
      // Fallback if import fails
      console.warn("Failed to load entitlements, using plan fallback", e);
    }
  }

  // Fallback: normalize plan string
  const normalized = (plan || "").toLowerCase().trim();
  
  if (normalized === "pro" || normalized === "professional") {
    return 6000;
  }
  if (normalized === "scale" || normalized === "ultra") {
    return 8000;
  }
  
  // Default to starter limit
  return 2000;
}

/**
 * Get or create discovery quota for a store (current month)
 * Never throws PGRST116 error - uses .maybeSingle() for initial read
 * 
 * @param storeId - Store ID
 * @param plan - Plan string (deprecated - use profile instead)
 * @param profile - Profile object (used to compute entitlements)
 * @param userCreatedAt - User created_at timestamp (for trial calculation)
 * @returns DiscoveryQuota or null if storeId is missing
 */
export async function getDiscoveryQuota(
  storeId: string,
  plan?: string | null,
  profile?: any,
  userCreatedAt?: string | Date
): Promise<DiscoveryQuota | null> {
  if (!storeId) {
    return null;
  }

  const supabase = await createClient();
  const period_start = monthStartISODate();
  const limit_products = getDiscoveryLimit(profile, userCreatedAt, plan);

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

  // If row exists, check if limit needs updating and return it
  if (existing) {
    const storedLimit = existing.limit_products || limit_products;
    let effectiveLimit = storedLimit;
    
    // If stored limit differs from current entitlements limit, update it
    // This handles cases where trial became active or plan changed
    if (storedLimit !== limit_products) {
      const { error: updateErr } = await supabase
        .from("competitor_discovery_quota")
        .update({ limit_products: limit_products })
        .eq("store_id", storeId)
        .eq("period_start", period_start);
      
      if (!updateErr) {
        effectiveLimit = limit_products;
      } else {
        console.warn("Failed to update discovery quota limit:", updateErr);
      }
    }
    
    const used = existing.used_products || 0;
    
    return {
      store_id: existing.store_id,
      period_start: existing.period_start,
      used,
      limit_amount: effectiveLimit,
      remaining: Math.max(0, effectiveLimit - used),
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
    // Return safe default object with current limit (from entitlements)
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

  // If existing row has different limit than current entitlements, update it
  // This handles cases where trial became active or plan changed
  const currentLimit = limit_products;
  const storedLimit = created.limit_products || limit_products;
  
  if (storedLimit !== currentLimit) {
    // Update the limit in DB to match current entitlements
    const { error: updateErr } = await supabase
      .from("competitor_discovery_quota")
      .update({ limit_products: currentLimit })
      .eq("store_id", storeId)
      .eq("period_start", period_start);
    
    if (updateErr) {
      console.warn("Failed to update discovery quota limit:", updateErr);
      // Continue with stored limit
    } else {
      // Use updated limit
      const used = created.used_products || 0;
      return {
        store_id: created.store_id,
        period_start: created.period_start,
        used,
        limit_amount: currentLimit,
        remaining: Math.max(0, currentLimit - used),
      };
    }
  }

  return {
    store_id: created.store_id,
    period_start: created.period_start,
    used: created.used_products || 0,
    limit_amount: storedLimit,
    remaining: storedLimit - (created.used_products || 0),
  };
}

/**
 * Consume discovery quota (returns success status and remaining quota)
 * Uses direct queries instead of RPC to ensure compatibility with period_start schema
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
  if (!storeId || amount < 0) {
    return null;
  }

  const supabase = await createClient();
  const period_start = monthStartISODate(); // First day of current month as YYYY-MM-DD

  // 1) Get or create quota record for current month
  const quota = await getDiscoveryQuota(storeId);
  if (!quota) {
    console.error('Error: Failed to get or create discovery quota');
    return null;
  }

  // 2) Check if consumption is allowed
  const newUsed = quota.used + amount;
  const allowed = newUsed <= quota.limit_amount;
  const remaining = allowed ? quota.limit_amount - newUsed : quota.limit_amount - quota.used;

  if (!allowed) {
    // Quota exceeded - return current state without updating
    return {
      allowed: false,
      remaining_products: remaining,
      limit_products: quota.limit_amount,
      used_products: quota.used,
    };
  }

  // 3) Update used_products in database
  const { error: updateError } = await supabase
    .from("competitor_discovery_quota")
    .update({
      used_products: newUsed,
    })
    .eq("store_id", storeId)
    .eq("period_start", period_start);

  if (updateError) {
    console.error('Error consuming discovery quota:', JSON.stringify({
      error: updateError,
      storeId,
      period_start,
      amount,
      currentUsed: quota.used,
      newUsed,
    }, null, 2));
    return null;
  }

  // 4) Return success result
  return {
    allowed: true,
    remaining_products: remaining,
    limit_products: quota.limit_amount,
    used_products: newUsed,
  };
}





