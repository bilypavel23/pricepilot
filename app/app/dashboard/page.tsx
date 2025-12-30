import { getProfile } from "@/lib/getProfile";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateStore } from "@/lib/store";
import { getRecommendationsWaitingCount } from "@/lib/recommendations/getRecommendationsWaitingCount";
import { getActivityEvents } from "@/lib/activity-events/getActivityEvents";

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
    // Load user's real products for their store (only active)
    const { data: userProducts } = await supabase
      .from("products")
      .select("id, name, price, inventory, cost, status")
      .eq("store_id", store.id)
      .eq("is_demo", false)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Load user's real competitors for their store
    const { data: userCompetitors } = await supabase
      .from("competitors")
      .select("id")
      .eq("store_id", store.id);

    products = userProducts ?? [];
    competitors = userCompetitors ?? [];
  }

  // Calculate metrics
  const productsCount = products.length;
  const competitorsCount = competitors.length;

  // Count competitor URLs (product_matches) for the store
  let competitorUrlsCount = 0;
  if (!isDemo) {
    const { count: urlsCount, error: urlsError } = await supabase
      .from("product_matches")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store.id);
    
    if (urlsError) {
      console.error("Error counting competitor URLs:", urlsError);
    } else {
      competitorUrlsCount = urlsCount || 0;
    }
  }

  // Calculate inventory worth (sum of price * inventory, or just price if no inventory)
  // Only count active products
  const inventoryWorth = products.reduce((sum, product) => {
    const price = product.price || 0;
    const inventory = product.inventory ?? 1; // Default to 1 if no inventory
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

  // Calculate recommendations waiting (only for non-demo)
  let recommendationsWaiting = 0;
  if (!isDemo) {
    recommendationsWaiting = await getRecommendationsWaitingCount(store.id);
  }

  // Competitor activity should show updated prices count from last sync (same as Recommendations page)
  let competitorActivityCount = 0;
  if (!isDemo && store.id) {
    const { data: syncData, error: syncError } = await supabase
      .from("store_sync_settings")
      .select("last_competitor_sync_updated_count")
      .eq("store_id", store.id)
      .maybeSingle();

    if (!syncError && syncData?.last_competitor_sync_updated_count !== null && syncData?.last_competitor_sync_updated_count !== undefined) {
      competitorActivityCount = syncData.last_competitor_sync_updated_count;
    }
  }

  // Calculate chart data (average price and margin from current products)
  let avgPrice = 0;
  let avgMargin: number | null = null;
  let hasCostData = false;

  if (products.length > 0) {
    // Calculate average price
    const totalPrice = products.reduce((sum, p) => sum + (p.price || 0), 0);
    avgPrice = totalPrice / products.length;

    // Calculate average margin if cost data exists
    const productsWithCost = products.filter((p) => p.price && p.cost && p.price > 0);
    if (productsWithCost.length > 0) {
      hasCostData = true;
      const totalMargin = productsWithCost.reduce((sum, p) => {
        const margin = ((p.price - p.cost) / p.price) * 100;
        return sum + margin;
      }, 0);
      avgMargin = Math.max(0, Math.min(100, totalMargin / productsWithCost.length));
    }
  }

  // Load activity events (only for non-demo)
  // Gracefully handle if table doesn't exist or RLS issues
  // Limit to 5 for dashboard preview
  let activityEvents: any[] = [];
  if (!isDemo) {
    try {
      activityEvents = await getActivityEvents(store.id, 5);
    } catch (err: any) {
      // Log but don't fail the page - activity events are non-critical
      console.warn("Could not load activity events (non-critical):", err?.message || err);
      activityEvents = [];
    }
  }

    return (
      <DashboardContent 
        isDemo={isDemo} 
        store={store}
        products={products}
        competitors={competitors}
        metrics={{
          productsCount,
          competitorsCount,
          competitorUrlsCount,
          inventoryWorth,
          averageMargin,
          competitorActivityCount,
          recommendationsWaiting,
        }}
        chartData={{
          avgPrice,
          avgMargin,
          hasCostData,
        }}
        activityEvents={activityEvents}
      />
    );
  } catch (error) {
    console.error("Error loading dashboard:", error);
    // If there's an error, redirect to login as a fallback
    redirect("/login");
  }
}
