/**
 * Product Limit Enforcement
 * 
 * Provides functions to check and enforce product limits based on plan.
 */

import { createClient } from "@/lib/supabase/server";
import { getMaxProducts, wouldExceedProductLimit, getPlanConfig } from "@/lib/plans";

export interface ProductLimitCheck {
  allowed: boolean;
  currentCount: number;
  limit: number;
  canAdd: number;
  error?: string;
}

/**
 * Get current product count for a store
 */
export async function getProductCount(storeId: string): Promise<number> {
  const supabase = await createClient();
  
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'active');
  
  if (error) {
    console.error('Error counting products:', error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Check if adding products is allowed for a store based on plan
 */
export async function checkProductLimit(
  storeId: string,
  plan: string | null | undefined,
  addCount: number = 1
): Promise<ProductLimitCheck> {
  const currentCount = await getProductCount(storeId);
  const { exceeded, limit, canAdd } = wouldExceedProductLimit(currentCount, addCount, plan);
  
  if (exceeded) {
    const planConfig = getPlanConfig(plan);
    return {
      allowed: false,
      currentCount,
      limit,
      canAdd,
      error: `Product limit reached for your plan (${planConfig.productsLabel} products). ${
        canAdd > 0 
          ? `You can add ${canAdd} more product(s).` 
          : 'Upgrade your plan to add more products.'
      }`,
    };
  }
  
  return {
    allowed: true,
    currentCount,
    limit,
    canAdd,
  };
}

/**
 * Enforce product limit - returns how many products can be added
 * Use this for bulk imports to do partial imports up to the limit
 */
export async function enforceProductLimit(
  storeId: string,
  plan: string | null | undefined,
  requestedCount: number
): Promise<{
  allowedCount: number;
  currentCount: number;
  limit: number;
  truncated: boolean;
  message?: string;
}> {
  const currentCount = await getProductCount(storeId);
  const limit = getMaxProducts(plan);
  const available = Math.max(0, limit - currentCount);
  const allowedCount = Math.min(requestedCount, available);
  const truncated = allowedCount < requestedCount;
  
  let message: string | undefined;
  if (truncated) {
    if (allowedCount === 0) {
      message = `Product limit reached (${limit} products). Upgrade your plan to add more products.`;
    } else {
      message = `Only ${allowedCount} of ${requestedCount} products imported due to plan limit (${limit} products).`;
    }
  }
  
  return {
    allowedCount,
    currentCount,
    limit,
    truncated,
    message,
  };
}

/**
 * Get user's plan from profile
 */
export async function getUserPlan(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  
  return profile?.plan || null;
}



