import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";

export default async function RecommendationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const store = await getOrCreateStore();

  return (
    <RecommendationsClient
      store={{
        platform: store.platform,
        shopify_access_token: store.shopify_access_token,
      }}
    />
  );
}
