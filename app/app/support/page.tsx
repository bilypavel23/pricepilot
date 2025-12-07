import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SupportDashboard() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div>Unauthorized</div>;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return <div>Unauthorized</div>;

  const { data: conversations } = await supabase
    .from("support_conversations")
    .select("id, user_id, last_message_at, last_message_from, subject")
    .order("last_message_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support Inbox</h1>
        <p className="text-sm text-muted-foreground">
          {conversations?.length ?? 0} open conversation
          {(conversations?.length ?? 0) === 1 ? "" : "s"}
        </p>
      </div>

      {(!conversations || conversations.length === 0) && (
        <div className="rounded-xl border border-white/5 bg-neutral-900/70 px-4 py-6 text-sm text-muted-foreground">
          No conversations yet. When users contact support, their messages will appear here.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {conversations?.map((conv) => (
          <Link
            key={conv.id}
            href={`/app/support/${conv.id}`}
            className="flex flex-col gap-1 rounded-xl border border-white/5 bg-neutral-900/70 px-4 py-3 hover:border-blue-500/70 hover:bg-neutral-800/80 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">
                {conv.subject && conv.subject.trim().length > 0
                  ? conv.subject
                  : `Conversation #${conv.id.slice(0, 8)}`}
              </div>
              <span className="text-[11px] uppercase tracking-wide text-xs text-blue-400">
                Last from: {conv.last_message_from}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {conv.last_message_at
                ? new Date(conv.last_message_at as string).toLocaleString()
                : "No activity yet"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

