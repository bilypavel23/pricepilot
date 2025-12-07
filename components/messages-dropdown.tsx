"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

export function MessagesDropdown() {
  const [openDialog, setOpenDialog] = React.useState(false);
  const [openSupport, setOpenSupport] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState(false);
  const [selected, setSelected] = React.useState<Message | null>(null);
  const [supportSubject, setSupportSubject] = React.useState("");
  const [supportMessage, setSupportMessage] = React.useState("");

  const unreadCount = MOCK_MESSAGES.filter(m => m.unread).length;

  const handleOpenMessage = (message: Message) => {
    setSelected(message);
    setOpenDialog(true);
  };

  const handleSendSupport = () => {
    // TODO: Send support request to backend
    console.log("Support request:", { subject: supportSubject, message: supportMessage });
    setSupportSubject("");
    setSupportMessage("");
    setOpenSupport(false);
  };

  return (
    <>
      <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-9 w-9 p-0"
            aria-label="Open messages"
          >
            <Mail className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <DropdownMenuLabel className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Messages</span>
            <span className="text-[10px] uppercase tracking-wide">
              {unreadCount} unread
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {MOCK_MESSAGES.map((message) => (
            <DropdownMenuItem
              key={message.id}
              className="flex flex-col items-start gap-0.5 rounded-lg px-2 py-2.5 text-sm focus:bg-slate-50 dark:focus:bg-slate-800"
              onClick={() => handleOpenMessage(message)}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {message.title}
                </span>
                {message.unread && (
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                )}
              </div>
              <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                {message.preview}
              </span>
              <span className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {message.time}
              </span>
            </DropdownMenuItem>
          ))}

          {MOCK_MESSAGES.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              No messages yet.
            </div>
          )}

          <div
            onClick={() => {
              setOpenSupport(true);
              setOpenDropdown(false);
            }}
            className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-200 dark:border-slate-800 mt-1"
          >
            Contact Support
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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
            onSubmit={(e) => {
              e.preventDefault();
              handleSendSupport();
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                placeholder="What can we help you with?"
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                required
              />
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
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenSupport(false);
                  setSupportSubject("");
                  setSupportMessage("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                Send to Support
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

