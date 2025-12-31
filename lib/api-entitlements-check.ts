/**
 * Helper to check entitlements.canWrite in API routes
 * Returns NextResponse with 403 error if write is blocked, or null if allowed
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "./billing/entitlements";

/**
 * Check if user can perform write operations
 * Returns error response if blocked, or null if allowed
 */
export async function checkCanWrite(userId: string): Promise<NextResponse | null> {
  const supabase = await createClient();

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get user created_at for trial calculation
  const { data: { user } } = await supabase.auth.getUser();
  const userCreatedAt = user?.created_at;

  // Get entitlements
  const entitlements = getEntitlements(profile, userCreatedAt);

  if (!entitlements.canWrite) {
    return NextResponse.json(
      { error: "Trial ended. Upgrade to continue." },
      { status: 403 }
    );
  }

  return null;
}

