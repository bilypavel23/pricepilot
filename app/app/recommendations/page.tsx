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

  const isDemo = profile?.plan === "free_demo";
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

  const plan = (profile?.plan as string) ?? "STARTER";

  return (
    <RecommendationsClient
      store={{
        platform: store.platform,
        shopify_access_token: store.shopify_access_token,
      }}
      recommendations={recommendations}
      hasProducts={hasProducts}
      plan={plan}
    />
  );
}
