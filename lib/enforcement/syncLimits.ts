/**
 * Sync Frequency Enforcement
 * 
 * Provides functions to track and enforce sync limits based on plan.
 */

import { createClient } from "@/lib/supabase/server";
import { getSyncsPerDay, canRunSync, getHoursBetweenSyncs, getPlanConfig } from "@/lib/plans";

export interface SyncLimitCheck {
  allowed: boolean;
  todayCount: number;
  limit: number;
  remaining: number;
  nextAllowedAt?: Date;
  reason?: string;
}

/**
 * Get today's sync count for a store
 */
export async function getTodaySyncCount(storeId: string): Promise<number> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Check store_sync_runs table
  const { data, error } = await supabase
    .from('store_sync_runs')
    .select('sync_count')
    .eq('store_id', storeId)
    .eq('run_date', today)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error getting sync count:', error);
  }
  
  return data?.sync_count || 0;
}

/**
 * Increment today's sync count for a store
 */
export async function incrementSyncCount(storeId: string): Promise<number> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Try to get existing record
  const { data: existing } = await supabase
    .from('store_sync_runs')
    .select('id, sync_count')
    .eq('store_id', storeId)
    .eq('run_date', today)
    .single();
  
  if (existing) {
    // Update existing record
    const newCount = (existing.sync_count || 0) + 1;
    await supabase
      .from('store_sync_runs')
      .update({ 
        sync_count: newCount,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return newCount;
  }
  
  // Insert new record
  const { error } = await supabase
    .from('store_sync_runs')
    .insert({
      store_id: storeId,
      run_date: today,
      sync_count: 1,
      last_sync_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('Error inserting sync count:', error);
  }
  
  return 1;
}

/**
 * Check if a sync is allowed for a store based on plan
 */
export async function checkSyncLimit(
  storeId: string,
  plan: string | null | undefined
): Promise<SyncLimitCheck> {
  const todayCount = await getTodaySyncCount(storeId);
  const { allowed, limit, remaining, reason } = canRunSync(todayCount, plan);
  
  let nextAllowedAt: Date | undefined;
  
  if (!allowed && limit > 0) {
    // Calculate when next sync window opens (tomorrow at midnight)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    nextAllowedAt = tomorrow;
  }
  
  return {
    allowed,
    todayCount,
    limit,
    remaining,
    nextAllowedAt,
    reason,
  };
}

/**
 * Check if enough time has passed since last sync based on plan frequency
 */
export async function checkSyncCooldown(
  storeId: string,
  plan: string | null | undefined,
  lastSyncAt: string | null
): Promise<{
  allowed: boolean;
  nextAllowedAt?: Date;
  reason?: string;
}> {
  if (!lastSyncAt) {
    return { allowed: true };
  }
  
  const hoursBetween = getHoursBetweenSyncs(plan);
  const lastSync = new Date(lastSyncAt);
  const nextAllowed = new Date(lastSync.getTime() + hoursBetween * 60 * 60 * 1000);
  const now = new Date();
  
  if (nextAllowed > now) {
    return {
      allowed: false,
      nextAllowedAt: nextAllowed,
      reason: `Sync already ran recently. Next sync available at ${nextAllowed.toISOString()}`,
    };
  }
  
  return { allowed: true };
}

/**
 * Full sync permission check - combines daily limit and cooldown
 */
export async function canPerformSync(
  storeId: string,
  plan: string | null | undefined,
  lastSyncAt: string | null
): Promise<SyncLimitCheck & { cooldownPassed: boolean }> {
  // Check daily limit
  const limitCheck = await checkSyncLimit(storeId, plan);
  
  if (!limitCheck.allowed) {
    return { ...limitCheck, cooldownPassed: false };
  }
  
  // Check cooldown
  const cooldownCheck = await checkSyncCooldown(storeId, plan, lastSyncAt);
  
  if (!cooldownCheck.allowed) {
    return {
      ...limitCheck,
      allowed: false,
      cooldownPassed: false,
      nextAllowedAt: cooldownCheck.nextAllowedAt,
      reason: cooldownCheck.reason,
    };
  }
  
  return { ...limitCheck, cooldownPassed: true };
}

/**
 * Record a successful sync run
 */
export async function recordSyncRun(storeId: string): Promise<void> {
  await incrementSyncCount(storeId);
}

