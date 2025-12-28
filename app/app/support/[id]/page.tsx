import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SupportReplyForm from "./reply-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SupportConversationPage({ params }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div>Unauthorized</div>;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return <div>Unauthorized</div>;
  }

  const { id } = await params;
  const conversationId = id;

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, user_id, subject")
    .eq("id", conversationId)
    .single();

  let userEmail: string | null = null;
  if (conversation?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", conversation.user_id as string)
      .single();
    userEmail = profile?.email ?? null;
  }

  const { data: messages, error: messagesError } = await supabase
    .from("support_messages")
    .select("id, sender_type, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return (
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/app/support"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to inbox</span>
          </Link>
        </div>
        <h1 className="text-xl font-bold mb-4">Conversation {conversationId}</h1>
        <div className="text-red-400 text-sm">
          Failed to load messages: {messagesError.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex justify-center">
      <div className="flex h-[calc(100vh-3rem)] w-full max-w-4xl flex-col">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <Link
            href="/app/support"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to inbox</span>
          </Link>

          <div className="text-right">
            <div className="text-sm font-semibold">
              Support Conversation
            </div>
            <div className="text-xs text-muted-foreground">
              Support view
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-neutral-900/80 p-4 space-y-3">
          {(!messages || messages.length === 0) && (
            <div className="text-sm text-muted-foreground">
              No messages in this conversation yet.
            </div>
          )}

          {messages?.map((m) => {
            const isSupport = m.sender_type === "support";
            const senderLabel = isSupport
              ? "Support"
              : userEmail ?? "User";

            return (
              <div
                key={m.id}
                className={`max-w-xl rounded-lg px-3 py-2 text-sm shadow-sm ${
                  isSupport
                    ? "ml-auto bg-blue-600/90 text-white"
                    : "mr-auto bg-neutral-800 text-neutral-50"
                }`}
              >
                <div className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
                  {senderLabel}
                </div>

                <div>{m.body}</div>

                <div className="mt-1 text-[10px] opacity-60">
                  {new Date(m.created_at as string).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply box */}
        <div className="mt-4 border-t border-white/10 pt-3">
          <SupportReplyForm conversationId={conversationId} />
        </div>
      </div>
    </div>
  );
}
