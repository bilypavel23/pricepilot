import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";
import { checkProductLimit, getUserPlan } from "@/lib/enforcement/productLimits";

export async function POST(req: Request) {
  try {
    // Check authentication and demo mode
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan;
    const isDemo = plan === "free_demo";

    if (isDemo) {
      return NextResponse.json(
        { error: "Demo mode: You can't add products. Upgrade to STARTER to connect your store." },
        { status: 403 }
      );
    }

    // Get or create store for the user
    const store = await getOrCreateStore();

    // Check product limit BEFORE adding
    const limitCheck = await checkProductLimit(store.id, plan, 1);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          error: limitCheck.error,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = (body.name ?? "").trim();
    const sku = (body.sku ?? "").trim();
    const price = body.price;

    if (!name || !sku || price === undefined || price === null || isNaN(Number(price))) {
      return NextResponse.json(
        { error: "Missing or invalid required fields (name, sku, price)." },
        { status: 400 }
      );
    }

    const cost = body.cost !== undefined && body.cost !== null && body.cost !== ""
      ? Number(body.cost)
      : null;

    const inventory =
      body.inventory !== undefined && body.inventory !== null && body.inventory !== ""
        ? Number(body.inventory)
        : null;

    const insertData = {
      store_id: store.id,
      name,
      sku,
      price: Number(price),
      cost,
      inventory,
      currency: "USD",
      is_demo: false,
    };

    const { error } = await supabase
      .from("products")
      .insert(insertData);

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { 
          error: "Failed to add product.", 
          details: error.message,
          code: error.code,
          hint: error.hint 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Add product error:", err);
    return NextResponse.json(
      { error: "Unexpected error while adding product.", details: String(err) },
      { status: 500 }
    );
  }
}
