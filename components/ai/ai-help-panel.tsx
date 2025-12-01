"use client";

import { useState } from "react";
import { MessageSquare, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AiHelpButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm PricePilot AI. How can I help you with pricing, competitors, or margins today?",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // TODO: Replace with real LLM API call (OpenAI, Anthropic, etc.)
    // Mock AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "This is a mock response. In the future, this will connect to a real AI backend to provide insights about your pricing strategy, competitor analysis, and margin optimization.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-[0_18px_45px_rgba(37,99,235,0.55)] dark:shadow-[0_18px_45px_rgba(15,23,42,0.8)] flex items-center justify-center text-white transition-transform duration-150 hover:scale-105 z-50"
        aria-label="Ask PricePilot AI"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-white/10 flex-shrink-0 relative">
            <SheetHeader className="p-0 border-0 flex-1">
              <SheetTitle className="text-xl font-semibold flex items-center gap-2 dark:text-white">
                <Bot className="h-5 w-5 text-blue-500" />
                PricePilot AI (mock)
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground dark:text-gray-400">
                Ask questions about your pricing, competitors, and margins.
              </SheetDescription>
            </SheetHeader>
            <SheetClose onClick={() => setOpen(false)} />
          </div>

          {/* Messages area - scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex animate-fade-in",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl p-4 shadow-sm text-sm",
                    message.role === "user"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                      : "bg-muted text-foreground dark:bg-[#161b25] dark:text-gray-200 dark:border dark:border-white/10"
                  )}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input area - fixed at bottom */}
          <div className="border-t border-border dark:border-white/10 px-4 py-3 flex-shrink-0 bg-white dark:bg-[#0f1117]">
            <form 
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Ask a question..."
                className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button 
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium shadow-md"
              >
                Send
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
