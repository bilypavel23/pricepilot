import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1) Auth & admin check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Read body
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

    // 3) Check conversation exists
    const { data: conv, error: convError } = await supabase
      .from("support_conversations")
      .select("id")
      .eq("id", conversationId)
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // 4) Insert support message
    const { error: insertError } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "support",
        body: message.trim(),
      });

    if (insertError) {
      console.error("Failed to insert support reply:", insertError);
      return NextResponse.json(
        { error: "Failed to save reply" },
        { status: 500 }
      );
    }

    // 5) Update conversation meta (last_message_from + last_message_at)
    const { error: updateError } = await supabase
      .from("support_conversations")
      .update({
        last_message_from: "support",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Failed to update conversation:", updateError);
      // not fatal for the UI, but log it
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Support reply API error:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
