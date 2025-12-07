import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    // Normal user inbox – we don't need this for admins
    const { data, error } = await supabase
      .from("support_conversations")
      .select("id, subject, last_message_from, last_message_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Inbox load error:", error);
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    return NextResponse.json({ conversations: data ?? [] }, { status: 200 });
  } catch (e) {
    console.error("Inbox unexpected error:", e);
    return NextResponse.json({ conversations: [] }, { status: 200 });
  }
}

