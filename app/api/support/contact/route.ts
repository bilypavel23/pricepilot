import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subject, message } = await req.json().catch(() => ({
    subject: "",
    message: "",
  }));

  if (
    !subject ||
    typeof subject !== "string" ||
    subject.trim().length < 3
  ) {
    return NextResponse.json(
      { error: "Subject is too short" },
      { status: 400 }
    );
  }

  if (
    !message ||
    typeof message !== "string" ||
    message.trim().length < 5
  ) {
    return NextResponse.json(
      { error: "Message is too short" },
      { status: 400 }
    );
  }

  // 1) najít existující open konverzaci nebo vytvořit novou
  const { data: existingConvs, error: convErr } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "open")
    .limit(1);

  if (convErr) {
    return NextResponse.json(
      { error: `Failed to load conversations: ${convErr.message}` },
      { status: 500 }
    );
  }

  let conversationId: string;

  if (existingConvs && existingConvs.length > 0) {
    conversationId = existingConvs[0].id;
  } else {
    const { data: newConv, error: newConvErr } = await supabase
      .from("support_conversations")
      .insert({
        user_id: user.id,
        status: "open",
        last_message_from: "user",
        subject: "Support Conversation",
      })
      .select("id")
      .single();

    if (newConvErr || !newConv) {
      return NextResponse.json(
        { error: `Failed to create conversation: ${newConvErr?.message}` },
        { status: 500 }
      );
    }

    conversationId = newConv.id;
  }

  // 2) vložit zprávu
  const { error: msgErr } = await supabase.from("support_messages").insert({
    conversation_id: conversationId,
    sender_type: "user",
    sender_id: user.id,
    body: message.trim(),
  });

  if (msgErr) {
    return NextResponse.json(
      { error: `Failed to save message: ${msgErr.message}` },
      { status: 500 }
    );
  }

  // 3) update last_message_at
  await supabase
    .from("support_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_from: "user",
    })
    .eq("id", conversationId);

  return NextResponse.json({ success: true });
}

