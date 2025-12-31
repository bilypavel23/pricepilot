"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AppFooter } from "./app-footer";
import { AiHelpButton } from "@/components/ai/ai-help-panel";
import { type Plan } from "@/lib/planLimits";

export function AppShell({ 
  children, 
  plan,
  canUseAIChat = false,
  isDemo = false
}: { 
  children: React.ReactNode;
  plan: Plan;
  canUseAIChat?: boolean;
  isDemo?: boolean;
}) {
  // Use canUseAIChat prop from entitlements instead of checking plan directly
  const showAiChat = canUseAIChat;

  return (
    <div className="flex h-screen overflow-hidden bg-background dark:bg-[#0c0e16]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar plan={plan} isDemo={isDemo} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex-shrink-0">{children}</main>
        <AppFooter />
      </div>
      {showAiChat && <AiHelpButton />}
    </div>
  );
}
