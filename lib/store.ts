import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Get or create a store for the current authenticated user.
 * If no store exists, automatically creates a default store.
 */
export async function getOrCreateStore() {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  // Try to find existing store for this user
  const { data: existingStores, error: storeError } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (existingStores && existingStores.length > 0) {
    return existingStores[0];
  }

  // No store -> create a default one
  const { data: inserted, error: insertError } = await supabase
    .from("stores")
    .insert({
      owner_id: user.id,
      name: "My main store",
      currency: "USD",
      timezone: "Europe/Prague",
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to create default store");
  }

  return inserted;
}

