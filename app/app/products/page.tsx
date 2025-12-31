import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProductsClient } from "@/components/products/products-client";

// Force dynamic rendering because we use cookies()
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const { user, profile } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  // isDemo is true only if raw plan is free_demo AND trial is NOT active (expired trial)
  const rawPlan = profile?.plan;
  const trialActive = profile?.trial_active ?? false;
  const isDemo = rawPlan === "free_demo" && !trialActive;
  
  // Use effective_plan for limits (maps free_demo with active trial to pro)
  const effectivePlan = profile?.effective_plan ?? rawPlan ?? "free_demo";

  // Get or create store (automatically creates one if none exists)
  const store = await getOrCreateStore();

  // Create Supabase client for server-side queries
  const supabase = await createClient();

  // Load products for the store
  let products: any[] = [];

  if (isDemo) {
    // Load demo products
    const { data: demoProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_demo", true)
      .order("created_at", { ascending: false });

    products = demoProducts ?? [];
  } else {
    // Load user's real products for their store
    const { data: userProducts } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_demo", false)
      .order("created_at", { ascending: false });

    products = userProducts ?? [];
  }

  const productCount = products.length;

  // Load sync status from view
  let syncStatus: {
    last_sync_local: string | null;
    products_sync_source: string | null;
  } | null = null;

  if (!isDemo && store.id) {
    const { data: syncData, error: syncError } = await supabase
      .from("store_products_sync_status_safe")
      .select("last_sync_local, products_sync_source")
      .eq("store_id", store.id)
      .maybeSingle();

    if (!syncError && syncData) {
      syncStatus = {
        last_sync_local: syncData.last_sync_local,
        products_sync_source: syncData.products_sync_source,
      };
    }
  }

  return (
    <ProductsClient
      initialProducts={products}
      isDemo={isDemo}
      store={store}
      productCount={productCount}
      syncStatus={syncStatus}
    />
  );
}
