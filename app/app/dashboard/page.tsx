import { getProfile } from "@/lib/getProfile";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { user, profile } = await getProfile();
  
  if (!user) {
    redirect("/sign-in");
  }

  const isDemo = profile?.plan === "free_demo";

  // Create Supabase client for server-side queries
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
      },
    }
  );

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
    // Load user's real products
    const { data: userProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_demo", false)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Load user's real competitors
    const { data: userCompetitors } = await supabase
      .from("competitors")
      .select("*")
      .eq("is_demo", false)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    products = userProducts ?? [];
    competitors = userCompetitors ?? [];
  }

  return (
    <DashboardContent 
      isDemo={isDemo} 
      products={products}
      competitors={competitors}
    />
  );
}
