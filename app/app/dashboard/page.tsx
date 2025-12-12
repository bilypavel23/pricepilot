import { getProfile } from "@/lib/getProfile";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateStore } from "@/lib/store";

// Force dynamic rendering because we use cookies()
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const { user, profile } = await getProfile();
    
    if (!user) {
      redirect("/login");
    }

    const isDemo = profile?.plan === "free_demo";

    // Get or create store (automatically creates one if none exists)
    const store = await getOrCreateStore();

    // Create Supabase client for server-side queries
    const supabase = await createClient();

  // Load products and competitors based on demo mode
  let products: any[] = [];
  let competitors: any[] = [];
  let productMatches: any[] = [];
  let priceRecommendations: any[] = [];

  if (isDemo) {
    // Load demo products
    const { data: demoProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_demo", true)
      .order("created_at", { ascending: false });

    // Load demo competitors
    const { data: demoCompetitors } = await supabase
      .from("competitors")
      .select("*")
      .eq("is_demo", true)
      .order("created_at", { ascending: false });

    products = demoProducts ?? [];
    competitors = demoCompetitors ?? [];
  } else {
    // Load user's real products for their store
    const { data: userProducts } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_demo", false)
      .order("created_at", { ascending: false });

    // Load user's real competitors for their store
    const { data: userCompetitors } = await supabase
      .from("competitors")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    // Load product matches for competitor activity
    const { data: matches } = await supabase
      .from("product_matches")
      .select("id")
      .eq("store_id", store.id);

    // Load price recommendations (if table exists)
    const { data: recommendations } = await supabase
      .from("price_recommendations")
      .select("id, status")
      .eq("store_id", store.id);

    products = userProducts ?? [];
    competitors = userCompetitors ?? [];
    productMatches = matches ?? [];
    priceRecommendations = recommendations ?? [];
  }

  // Calculate metrics
  const productsCount = products.length;
  const competitorsCount = competitors.length;
  const matchesCount = productMatches.length;
  const recommendationsCount = priceRecommendations.length;
  const pendingRecommendationsCount = priceRecommendations.filter((r: any) => r.status === "pending").length;

  // Calculate revenue estimate (sum of price * inventory, or just price if no inventory)
  const revenueEstimate = products.reduce((sum, product) => {
    const price = product.price || 0;
    const inventory = product.inventory || 1; // Default to 1 if no inventory
    return sum + (price * inventory);
  }, 0);

  // Calculate average margin
  let averageMargin = 0;
  const productsWithMargin = products.filter((p) => p.price && p.cost);
  if (productsWithMargin.length > 0) {
    const totalMargin = productsWithMargin.reduce((sum, product) => {
      const margin = ((product.price - product.cost) / product.price) * 100;
      return sum + margin;
    }, 0);
    averageMargin = totalMargin / productsWithMargin.length;
  }

  // Calculate expected revenue next week (simple estimate: current revenue * 1.1)
  const expectedRevenueNextWeek = {
    min: Math.round(revenueEstimate * 0.95),
    max: Math.round(revenueEstimate * 1.15),
  };

    return (
      <DashboardContent 
        isDemo={isDemo} 
        store={store}
        products={products}
        competitors={competitors}
        metrics={{
          productsCount,
          competitorsCount,
          matchesCount,
          recommendationsCount,
          pendingRecommendationsCount,
          revenueEstimate,
          averageMargin,
          expectedRevenueNextWeek,
        }}
      />
    );
  } catch (error) {
    console.error("Error loading dashboard:", error);
    // If there's an error, redirect to login as a fallback
    redirect("/login");
  }
}
