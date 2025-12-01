"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AiHelpButton } from "@/components/ai/ai-help-panel";
import { hasAiChatAccess } from "@/lib/planLimits";

// TODO: Replace with real plan from Supabase user profile
const currentPlan: "STARTER" | "PRO" | "SCALE" = "STARTER";

export function AppShell({ children }: { children: React.ReactNode }) {
  const showAiChat = hasAiChatAccess(currentPlan);

  return (
    <div className="flex h-screen overflow-hidden bg-background dark:bg-[#0c0e16]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      {showAiChat && <AiHelpButton />}
    </div>
  );
}
