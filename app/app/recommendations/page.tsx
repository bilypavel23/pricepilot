import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";
import { getRecommendationsForStore } from "@/lib/recommendations/getRecommendations";

export default async function RecommendationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getOrCreateStore();

  // Check if there are any products at all
  const { count: productsCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("status", "active");

  const hasProducts = (productsCount ?? 0) > 0;

  // Load recommendations
  const recommendations = hasProducts
    ? await getRecommendationsForStore(store.id)
    : [];

  return (
    <RecommendationsClient
      store={{
        platform: store.platform,
        shopify_access_token: store.shopify_access_token,
      }}
      recommendations={recommendations}
      hasProducts={hasProducts}
    />
  );
}
