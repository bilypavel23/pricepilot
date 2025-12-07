"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  conversationId: string;
}

export default function SupportReplyForm({ conversationId }: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const sendReply = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to send reply");
      } else {
        setMessage("");
        router.refresh();
      }
    } catch (e) {
      setError("Failed to send reply");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-white/10 bg-neutral-900/80 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your reply…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendReply();
            }
          }}
        />
        <button
          onClick={sendReply}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

