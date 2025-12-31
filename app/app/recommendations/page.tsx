import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/getProfile";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";
import { getRecommendationsForStore } from "@/lib/recommendations/getRecommendations";

export default async function RecommendationsPage() {
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
  
  const store = await getOrCreateStore();
  const supabase = await createClient();

  // Load products using the same query as Products page
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
    // Load user's real products for their store (only active)
    const { data: userProducts } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_demo", false)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    products = userProducts ?? [];
  }

  const hasProducts = products.length > 0;

  // Load recommendations (always returns all products, even without competitors)
  const recommendations = hasProducts
    ? await getRecommendationsForStore(store.id)
    : [];

  const plan = (effectivePlan as string) ?? "STARTER";

  // Check if user has products without competitors
  const productsWithoutCompetitors = recommendations.filter((r) => r.competitorCount === 0);

  // Load sync status from store_sync_settings
  let syncStatus: {
    last_competitor_sync_at: string | null;
    last_competitor_sync_status: string | null;
    last_competitor_sync_updated_count: number | null;
  } | null = null;

  if (!isDemo && store.id) {
    const { data: syncData, error: syncError } = await supabase
      .from("store_sync_settings")
      .select("last_competitor_sync_at, last_competitor_sync_status, last_competitor_sync_updated_count")
      .eq("store_id", store.id)
      .maybeSingle();

    if (!syncError && syncData) {
      syncStatus = {
        last_competitor_sync_at: syncData.last_competitor_sync_at,
        last_competitor_sync_status: syncData.last_competitor_sync_status,
        last_competitor_sync_updated_count: syncData.last_competitor_sync_updated_count,
      };
    }
  }

  return (
    <RecommendationsClient
      store={{
        platform: store.platform,
        shopify_access_token: store.shopify_access_token,
      }}
      recommendations={recommendations}
      hasProducts={hasProducts}
      plan={plan}
      hasProductsWithoutCompetitors={productsWithoutCompetitors.length > 0}
      syncStatus={syncStatus}
    />
  );
}
