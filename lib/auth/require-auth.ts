import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Server-only helper to require authentication in API routes.
 * Returns the authenticated user or a 401 NextResponse.
 * 
 * Usage:
 * ```ts
 * const authResult = await requireAuth();
 * if (authResult instanceof NextResponse) {
 *   return authResult; // 401 response
 * }
 * const { user, supabase } = authResult;
 * ```
 */
export async function requireAuth(): Promise<
  | { user: { id: string }; supabase: Awaited<ReturnType<typeof createClient>> }
  | NextResponse<{ error: string }>
> {
  const supabase = await createClient();
  
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user, supabase };
}


