"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Mail, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { type Plan } from "@/lib/planLimits";

type SupportConversationSummary = {
  id: string;
  subject: string | null;
  last_message_from: "user" | "support" | null;
  last_message_at: string | null;
};

type SupportMessage = {
  id: string;
  sender_type: "user" | "support";
  body: string;
  created_at: string;
};

type SupportConversationDetails = {
  id: string;
  subject: string | null;
};

type Message = {
  id: string;
  type: "summary" | "competitor" | "support";
  title: string;
  preview: string;
  body: string;
  time: string;
  unread?: boolean;
};

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    type: "summary",
    title: "Your Weekly Summary is Ready",
    preview: "Margins increased by 4.2% this week. Competitors changed 3 prices…",
    body: "This is a mock weekly summary. In the future we will show real metrics: margins, revenue, competitor changes, and AI suggestions.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: "2",
    type: "competitor",
    title: "ElectroHub lowered prices",
    preview: "ElectroHub dropped prices for Laptop Stand and USB-C Cable.",
    body: "Competitor 'ElectroHub' has updated pricing on multiple products. Review your recommendations to keep your margins healthy.",
    time: "Yesterday",
  },
  {
    id: "3",
    type: "support",
    title: "We received your support request",
    preview: "Thanks for contacting PricePilot support…",
    body: "Thanks for reaching out to PricePilot support. This is a mock message. Later this will show real replies from support.",
    time: "3 days ago",
  },
];

interface MessagesDropdownProps {
  plan: Plan;
  isDemo?: boolean; // True only for demo/test accounts, not free_demo trial users
}

export function MessagesDropdown({ plan, isDemo = false }: MessagesDropdownProps) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = React.useState(false);
  const [openSupport, setOpenSupport] = React.useState(false);
  const [openPanel, setOpenPanel] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [selected, setSelected] = React.useState<Message | null>(null);
  const [supportSubject, setSupportSubject] = React.useState("");
  const [supportMessage, setSupportMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [supportError, setSupportError] = React.useState<string | null>(null);
  const [subjectError, setSubjectError] = React.useState<string | null>(null);
  const [conversations, setConversations] = useState<SupportConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeConversation, setActiveConversation] =
    useState<SupportConversationSummary | null>(null);
  const [previewConversation, setPreviewConversation] =
    useState<SupportConversationDetails | null>(null);
  const [previewMessages, setPreviewMessages] = useState<SupportMessage[]>([]);
  const [previewReply, setPreviewReply] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (openPanel) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [openPanel]);

  // ESC key handler to close panel
  useEffect(() => {
    if (!openPanel) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenPanel(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [openPanel]);

  // Load announcements unread count
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const res = await fetch("/api/announcements/unread-count");
        const data = await res.json();
        setAnnouncementsUnreadCount(data.count ?? 0);
      } catch (e) {
        console.error("Failed to load announcements unread count", e);
      }
    };

    loadUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load support conversations
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/support/inbox");
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } catch (e) {
        console.error("Failed to load support inbox", e);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Only show mock messages for demo/test accounts (profile.is_demo === true), NOT for free_demo trial users
  // Check env flag as backup for explicit demo seeding
  const shouldShowMock = isDemo || process.env.NEXT_PUBLIC_ENABLE_DEMO_SEEDING === "true";
  const messages = shouldShowMock ? MOCK_MESSAGES : [];
  const mockUnreadCount = messages.filter(m => m.unread).length;
  
  // Compute unread count from support conversations (where last_message_from === "support")
  const supportUnreadCount = conversations.filter(
    (c) => c.last_message_from === "support"
  ).length;
  
  const unreadCount = mockUnreadCount + supportUnreadCount + announcementsUnreadCount;

  const handleOpenMessage = (message: Message) => {
    setSelected(message);
    setOpenDialog(true);
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportError(null);
    setSubjectError(null);

    if (!supportSubject.trim() || supportSubject.trim().length < 3) {
      setSubjectError("Please enter a subject (at least 3 characters).");
      return;
    }

    if (!supportMessage.trim() || supportMessage.trim().length < 5) {
      setSupportError("Message must be at least 5 characters long");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSupportError(data.error || "Failed to send message");
        return;
      }

      // Success - reset form and close modal
      setSupportSubject("");
      setSupportMessage("");
      setOpenSupport(false);
      // Refresh conversations to show the new one
      const refreshRes = await fetch("/api/support/inbox");
      const refreshData = await refreshRes.json();
      setConversations(refreshData.conversations ?? []);
    } catch (error) {
      console.error("Error sending support message:", error);
      setSupportError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const panelContent = openPanel && mounted ? (
    createPortal(
      <div
        className="fixed top-20 right-4 w-[420px] max-w-[calc(100vw-32px)] max-h-[70vh] z-[100] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Messages</h2>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {unreadCount} UNREAD
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpenPanel(false)}
                className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close messages"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">

            {/* Mock messages for demo tier */}
            {messages.length > 0 && (
              <>
                <div className="space-y-2 mb-4">
                  {messages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      className="w-full flex flex-col items-start gap-1 rounded-lg px-3 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                      onClick={() => {
                        handleOpenMessage(message);
                        setOpenPanel(false);
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {message.title}
                        </span>
                        {message.unread && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {message.preview}
                      </span>
                      <span className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {message.time}
                      </span>
                    </button>
                  ))}
                </div>
                {conversations.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 my-4" />
                )}
              </>
            )}

            {/* Product Updates - Fixed entry above conversations */}
            <button
              type="button"
              className="w-full rounded-lg px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col gap-1 transition-colors mb-4"
              onClick={async () => {
                setOpenPanel(false);
                router.push("/app/messages/updates");
                // Refresh unread count after a short delay to allow mark-read to complete
                setTimeout(() => {
                  fetch("/api/announcements/unread-count")
                    .then((res) => res.json())
                    .then((data) => setAnnouncementsUnreadCount(data.count ?? 0))
                    .catch(console.error);
                }, 1000);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Product Updates</span>
                    {announcementsUnreadCount > 0 && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Read-only updates from the team
                  </span>
                </div>
                {announcementsUnreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-blue-600 px-2 py-[2px] text-[10px] font-semibold text-white min-w-[20px] text-center">
                    {announcementsUnreadCount}
                  </span>
                )}
              </div>
            </button>

            {(conversations.length > 0 || messages.length > 0) && (
              <div className="border-t border-slate-200 dark:border-slate-800 my-4" />
            )}

            {/* Support conversations */}
            <div className="flex flex-col gap-2 text-sm">
              {loading && (
                <div className="text-muted-foreground text-xs px-2 py-2">Loading…</div>
              )}

              {!loading && conversations.length === 0 && messages.length === 0 && (
                <div className="text-muted-foreground text-xs px-2 py-4 text-center">
                  No messages yet.
                </div>
              )}

              {!loading &&
                conversations.map((conv) => {
                  const title = "Support Conversation";
                  const isUnread = conv.last_message_from === "support";

                  return (
                    <button
                      key={conv.id}
                      type="button"
                      className="w-full rounded-lg px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col gap-1 transition-colors"
                      onClick={async () => {
                        setActiveConversation(conv);
                        setPreviewOpen(true);
                        setPreviewLoading(true);
                        setPreviewError(null);
                        setOpenPanel(false);

                        try {
                          // Load conversation + messages
                          const res = await fetch(`/api/support/conversation/${conv.id}`);
                          const data = await res.json();

                          if (!res.ok) {
                            setPreviewError(data?.error || "Failed to load conversation");
                            setPreviewConversation(null);
                            setPreviewMessages([]);
                          } else {
                            setPreviewConversation(data.conversation);
                            setPreviewMessages(data.messages ?? []);
                          }

                          // Mark as read in DB
                          if (conv.last_message_from === "support") {
                            await fetch("/api/support/mark-read", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ conversationId: conv.id }),
                            });
                          }

                          // Update local state so unread badge disappears
                          setConversations((prev) =>
                            prev.map((c) =>
                              c.id === conv.id ? { ...c, last_message_from: "user" } : c
                            )
                          );
                        } catch (e) {
                          console.error("Failed to open conversation", e);
                          setPreviewError("Failed to load conversation");
                        } finally {
                          setPreviewLoading(false);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-900 dark:text-slate-100">
                          {title}
                        </span>
                        {isUnread && (
                          <span className="ml-2 rounded-full bg-blue-600 px-2 py-[2px] text-[10px] font-semibold text-white uppercase tracking-wide">
                            New reply
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleString()
                          : "No activity yet"}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Footer with Contact Support button */}
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-4">
            <button
              type="button"
              onClick={() => {
                setOpenSupport(true);
                setOpenPanel(false);
              }}
              className="w-full px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors text-center"
            >
              Contact Support
            </button>
          </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      {/* Trigger button */}
      <div
        className="relative rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-9 w-9 p-0 inline-flex items-center justify-center cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-white/5 dark:text-gray-200"
        onClick={() => setOpenPanel(!openPanel)}
        aria-label="Open messages"
      >
        <Mail className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Portal-based panel */}
      {panelContent}

      {/* Detail modal */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.title ?? "Message"}</DialogTitle>
            <DialogDescription>
              {selected?.time}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {selected?.body}
          </div>
        </DialogContent>
      </Dialog>

      {/* Support form modal */}
      <Dialog open={openSupport} onOpenChange={setOpenSupport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Send us a message and we'll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSendSupport}
            className="mt-4 space-y-4"
          >
            <div className="flex flex-col gap-1 mb-4">
              <Label htmlFor="support-subject">Subject</Label>
              <input
                id="support-subject"
                className="rounded-lg border border-white/10 bg-neutral-900/80 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Pricing issue, bug report, question…"
                value={supportSubject}
                onChange={(e) => {
                  setSupportSubject(e.target.value);
                  setSubjectError(null);
                }}
                disabled={isSending}
              />
              {subjectError && (
                <div className="text-xs text-red-400">{subjectError}</div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                placeholder="Describe your issue or question..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                rows={5}
                required
                minLength={5}
                disabled={isSending}
              />
              {supportError && (
                <p className="text-sm text-red-500 dark:text-red-400">{supportError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenSupport(false);
                  setSupportSubject("");
                  setSupportMessage("");
                  setSupportError(null);
                  setSubjectError(null);
                }}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSending}>
                {isSending ? "Sending..." : "Send to Support"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview card */}
      {previewOpen && (
        <>
          {/* Backdrop overlay to block interactions with background */}
          <div 
            className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md"
            onClick={() => setPreviewOpen(false)}
          />
          {/* Preview card */}
          <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-6 pointer-events-none"
            data-preview-open="true"
          >
            <div 
              className="w-full max-w-xl max-h-[80vh] my-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl pointer-events-auto flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <div className="text-base font-semibold text-white">
                  Support Conversation
                </div>
                {activeConversation?.last_message_at && (
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(
                      activeConversation.last_message_at
                    ).toLocaleString()}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-white transition-colors rounded-full p-1 hover:bg-slate-800"
                onClick={async () => {
                  setPreviewOpen(false);
                  // Refresh conversations to get any updates
                  try {
                    const refreshRes = await fetch("/api/support/inbox");
                    const refreshData = await refreshRes.json();
                    setConversations(refreshData.conversations ?? []);
                  } catch (e) {
                    console.error("Failed to refresh conversations", e);
                  }
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
              {previewLoading && (
                <div className="text-sm text-slate-400 text-center py-8">
                  Loading conversation…
                </div>
              )}

              {previewError && (
                <div className="text-sm text-red-400 text-center py-8">{previewError}</div>
              )}

              {!previewLoading &&
                !previewError &&
                previewMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-4 py-3 ${
                      m.sender_type === "support"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide opacity-80 mb-1.5 font-medium">
                      {m.sender_type === "support" ? "Support" : "You"}
                    </div>
                    <div className="text-sm leading-relaxed">{m.body}</div>
                    <div className="mt-1.5 text-xs opacity-70">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}

              {!previewLoading &&
                !previewError &&
                previewMessages.length === 0 && (
                  <div className="text-sm text-slate-400 text-center py-8">
                    No messages yet in this conversation.
                  </div>
                )}
            </div>

            {/* Fast reply */}
            <div className="border-t border-slate-700 px-6 py-4 flex-shrink-0 bg-slate-900/50">
              <div className="flex flex-col gap-2">
                {previewError && (
                  <div className="text-xs text-red-400">
                    You can't reply until the conversation loads.
                  </div>
                )}
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Type a quick reply…"
                    value={previewReply}
                    onChange={(e) => setPreviewReply(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (
                          !previewLoading &&
                          !previewError &&
                          activeConversation &&
                          previewReply.trim()
                        ) {
                          const text = previewReply.trim();
                          setPreviewReply("");
                          setPreviewError(null);

                          try {
                            const res = await fetch("/api/support/user-reply", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                conversationId: activeConversation.id,
                                message: text,
                              }),
                            });

                            const data = await res.json();

                            if (!res.ok) {
                              setPreviewError(
                                data?.error || "Failed to send reply"
                              );
                              return;
                            }

                            // Append the new user message locally
                            const now = new Date().toISOString();
                            setPreviewMessages((prev) => [
                              ...prev,
                              {
                                id: `local-${now}`,
                                sender_type: "user",
                                body: text,
                                created_at: now,
                              },
                            ]);

                            // Update local conversation meta
                            setConversations((prev) =>
                              prev.map((c) =>
                                c.id === activeConversation.id
                                  ? {
                                      ...c,
                                      last_message_from: "user" as const,
                                      last_message_at: now,
                                    }
                                  : c
                              )
                            );
                          } catch (err) {
                            console.error("Failed to send user reply", err);
                            setPreviewError("Failed to send reply");
                          }
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
                    disabled={
                      previewLoading ||
                      !!previewError ||
                      !activeConversation ||
                      !previewReply.trim()
                    }
                    onClick={async () => {
                      if (!activeConversation || !previewReply.trim()) return;

                      const text = previewReply.trim();

                      setPreviewReply("");
                      setPreviewError(null);

                      try {
                        const res = await fetch("/api/support/user-reply", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            conversationId: activeConversation.id,
                            message: text,
                          }),
                        });

                        const data = await res.json();

                        if (!res.ok) {
                          setPreviewError(
                            data?.error || "Failed to send reply"
                          );
                          return;
                        }

                        // Append the new user message locally
                        const now = new Date().toISOString();
                        setPreviewMessages((prev) => [
                          ...prev,
                          {
                            id: `local-${now}`,
                            sender_type: "user",
                            body: text,
                            created_at: now,
                          },
                        ]);

                        // Update local conversation meta
                        setConversations((prev) =>
                          prev.map((c) =>
                            c.id === activeConversation.id
                              ? {
                                  ...c,
                                  last_message_from: "user" as const,
                                  last_message_at: now,
                                }
                              : c
                          )
                        );
                      } catch (e) {
                        console.error("Failed to send user reply", e);
                        setPreviewError("Failed to send reply");
                      }
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </>
  );
}

