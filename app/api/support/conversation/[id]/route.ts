import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const conversationId = params.id;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure conversation belongs to this user
    const { data: conv, error: convError } = await supabase
      .from("support_conversations")
      .select("id, user_id, subject")
      .eq("id", conversationId)
      .single();

    if (convError || !conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: msgError } = await supabase
      .from("support_messages")
      .select("id, sender_type, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      return NextResponse.json(
        { error: "Failed to load messages" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        conversation: {
          id: conv.id,
          subject: conv.subject,
        },
        messages: messages ?? [],
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("GET conversation error:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}



