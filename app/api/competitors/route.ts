import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getOrCreateStore } from "@/lib/store";

export async function POST(req: Request) {
  try {
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

    const body = await req.json();
    const { name, url } = body;

    if (!name || !url) {
      return NextResponse.json({ error: "Missing name or url" }, { status: 400 });
    }

    // Get or create store (automatically creates one if none exists)
    const store = await getOrCreateStore();

    const { data, error } = await supabase
      .from("competitors")
      .insert({
        store_id: store.id,
        name: name.trim(),
        url: url.trim(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error inserting competitor:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, competitorId: data.id });
  } catch (err: any) {
    console.error("Error in POST /api/competitors:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

