import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using service role key.
 * Bypasses RLS - use only in server routes with proper ownership verification.
 * 
 * WARNING: Never expose this to the client. Only use in API routes.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);




