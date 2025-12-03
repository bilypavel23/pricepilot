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
        { error: "Demo mode: You can't import products. Upgrade to STARTER to connect your store." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const products = body.products;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "No products provided" },
        { status: 400 }
      );
    }

    // Validate required fields and prepare for insert
    const productsToInsert = products
      .map((p: any) => ({
        name: p.name?.trim() || null,
        sku: p.sku?.trim() || null,
        price: p.price != null && !isNaN(Number(p.price)) ? Number(p.price) : null,
        cost: p.cost != null && !isNaN(Number(p.cost)) ? Number(p.cost) : null,
        inventory: p.inventory != null && !isNaN(Number(p.inventory)) ? Number(p.inventory) : null,
        user_id: user.id,
        is_demo: false,
        source: "csv",
      }))
      .filter((p: any) => p.name && p.sku && p.price !== null);

    if (productsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid products to import (missing required fields)" },
        { status: 400 }
      );
    }

    // Insert into Supabase
    const { error } = await supabase
      .from("products")
      .insert(productsToInsert);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Database insert failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      imported: productsToInsert.length 
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Import failed", details: String(err) },
      { status: 500 }
    );
  }
}



