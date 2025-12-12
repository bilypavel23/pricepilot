import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await req.json().catch(() => ({
      conversationId: "",
    }));

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 }
      );
    }

    // Only allow marking as read for own conversations
    const { error } = await supabase
      .from("support_conversations")
      .update({
        // We use last_message_from as "unread" flag; clearing it to 'user' removes unread
        last_message_from: "user",
      })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Mark-read error:", error);
      return NextResponse.json(
        { error: "Failed to mark read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("Mark-read unexpected error:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}



