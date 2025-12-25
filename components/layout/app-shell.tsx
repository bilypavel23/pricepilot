"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AiHelpButton } from "@/components/ai/ai-help-panel";
import { hasAiChatAccess, type Plan } from "@/lib/planLimits";

export function AppShell({ 
  children, 
  plan 
}: { 
  children: React.ReactNode;
  plan: Plan;
}) {
  const showAiChat = hasAiChatAccess(plan);

  return (
    <div className="flex h-screen overflow-hidden bg-background dark:bg-[#0c0e16]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar plan={plan} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex-shrink-0">{children}</main>
      </div>
      {showAiChat && <AiHelpButton />}
    </div>
  );
}
