import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
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

    // TODO: replace with real workspace/store id later
    const storeId = "32dc14d2-88dd-457b-936b-a7f64e7324f4";

    const { error } = await supabase.from("products").insert({
      name,
      sku,
      price: Number(price),
      cost,
      inventory,
      store_id: storeId,
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

