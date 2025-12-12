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

  const isDemo = profile?.plan === "free_demo";

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

  return <ProductsClient initialProducts={products} isDemo={isDemo} store={store} />;
}
