import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    // Check authentication and demo mode
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

    const isDemo = profile?.plan === "free_demo";

    if (isDemo) {
      return NextResponse.json(
        { error: "Demo mode: You can't add products. Upgrade to STARTER to connect your store." },
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

    const { error } = await supabase.from("products").insert({
      name,
      sku,
      price: Number(price),
      cost,
      inventory,
      user_id: user.id,
      is_demo: false,
      source: "manual",
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to add product.", details: error.message },
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


