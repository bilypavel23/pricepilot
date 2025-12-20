import { createClient } from "@/lib/supabase/server";

export type DiscoveryQuota = {
  store_id: string;
  month_key: string;
  used: number;
  limit_amount: number;
  remaining: number;
};

/**
 * Get or create discovery quota for a store (current month)
 */
export async function getDiscoveryQuota(storeId: string): Promise<DiscoveryQuota | null> {
  if (!storeId) {
    return null;
  }

  const supabase = await createClient();
  
  // First, try to ensure quota exists
  const { error: ensureError } = await supabase.rpc('ensure_current_discovery_quota', {
    p_store_id: storeId,
  });
  
  if (ensureError) {
    console.error('Error ensuring discovery quota:', JSON.stringify(ensureError, null, 2));
    // Continue to try fetching anyway
  }
  
  // Now fetch the quota
  const { data, error } = await supabase.rpc('ensure_current_discovery_quota', {
    p_store_id: storeId,
  });
  
  if (error) {
    console.error('Error getting discovery quota:', JSON.stringify(error, null, 2));
    return null;
  }
  
  if (!data || data.length === 0) {
    // Try one more time to create and fetch
    const { data: retryData, error: retryError } = await supabase.rpc('ensure_current_discovery_quota', {
      p_store_id: storeId,
    });
    
    if (retryError || !retryData || retryData.length === 0) {
      console.error('Failed to get/create discovery quota after retry:', JSON.stringify(retryError || { message: 'No data returned' }, null, 2));
      return null;
    }
    
    const quota = retryData[0];
    return {
      store_id: quota.store_id,
      month_key: quota.month_key,
      used: quota.used_products || 0,
      limit_amount: quota.limit_products || 6000,
      remaining: quota.remaining_products || 6000,
    };
  }
  
  const quota = data[0];
  if (!quota) {
    return null;
  }
  
  return {
    store_id: quota.store_id,
    month_key: quota.month_key,
    used: quota.used_products || 0,
    limit_amount: quota.limit_products || 6000,
    remaining: quota.remaining_products || 6000,
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

