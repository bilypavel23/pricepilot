import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // poslední otevřená konverzace
  const { data: convs, error: convErr } = await supabase
    .from("support_conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(1);

  if (convErr) {
    return NextResponse.json(
      { error: `Failed to load conversation: ${convErr.message}` },
      { status: 500 }
    );
  }

  if (!convs || convs.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const conversationId = convs[0].id;

  const { data: messages, error: msgErr } = await supabase
    .from("support_messages")
    .select("id, sender_type, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (msgErr) {
    return NextResponse.json(
      { error: `Failed to load messages: ${msgErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ messages: messages ?? [] });
}



