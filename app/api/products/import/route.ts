import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
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
        store_id: "32dc14d2-88dd-457b-936b-a7f64e7324f4",
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



