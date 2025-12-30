import { createClient } from "@/lib/supabase/server";

/**
 * Get or create a store for the current authenticated user.
 * If no store exists, automatically creates a default store.
 */
export async function getOrCreateStore() {
  const supabase = await createClient();

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
  // Only insert columns that definitely exist (owner_id, name)
  const insertData: any = {
    owner_id: user.id,
    name: "My main store",
  };
  
  // Only add optional columns if they exist in the schema
  // currency and timezone might not exist, so we'll skip them for now
  
  const { data: inserted, error: insertError } = await supabase
    .from("stores")
    .insert(insertData)
    .select("*")
    .single();

  if (insertError) {
    console.error("Error creating store:", insertError);
    console.error("Insert data:", insertData);
    console.error("User ID:", user.id);
    
    // If RLS error, provide helpful message
    if (insertError.message?.includes("row-level security")) {
      throw new Error(
        "RLS policy error: Please run the SQL migration 'fix_stores_rls_simple.sql' in Supabase SQL Editor to enable store creation."
      );
    }
    
    throw new Error(insertError.message ?? "Failed to create default store");
  }
  
  if (!inserted) {
    throw new Error("Failed to create default store: No data returned");
  }

  return inserted;
}

