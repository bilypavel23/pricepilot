import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim() !== "");

    if (lines.length <= 1) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // Extract headers
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    // Parse each row
    const products = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const obj: any = {};

      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? null;
      });

      // Normalize name variants
      const name =
        obj.name ||
        obj.product_name ||
        obj.title ||
        null;

      return {
        name,
        sku: obj.sku || null,
        price: obj.price ? Number(obj.price) : null,
        cost: obj.cost ? Number(obj.cost) : null,
        inventory: obj.inventory ? Number(obj.inventory) : null,
        store_id: "6503e4bb-4d4d-4cdb-a241-ba032712f91a", 
        source: "csv",
      };
    });

    // Insert into Supabase
    const { error } = await supabase
      .from("products")
      .insert(products);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Database insert failed", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Import failed", details: err },
      { status: 500 }
    );
  }
}

