import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, message } = await req.json().catch(() => ({
      conversationId: "",
      message: "",
    }));

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 1) {
      return NextResponse.json(
        { error: "Message is too short" },
        { status: 400 }
      );
    }

    // Check conversation belongs to this user
    const { data: conv, error: convError } = await supabase
      .from("support_conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Insert user's message
    const { error: insertError } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "user",
        body: message.trim(),
      });

    if (insertError) {
      console.error("User reply insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save reply" },
        { status: 500 }
      );
    }

    // Update conversation meta
    const { error: updateError } = await supabase
      .from("support_conversations")
      .update({
        last_message_from: "user",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("User reply update conv error:", updateError);
      // Not fatal
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("User reply unexpected error:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}



