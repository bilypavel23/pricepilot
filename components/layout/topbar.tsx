"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, CreditCard, Settings } from "lucide-react";
import { PLAN_BADGES } from "@/lib/planLimits";
import { MessagesDropdown } from "@/components/messages-dropdown";
import { cn } from "@/lib/utils";

// TODO: Replace with real plan and store name from Supabase user profile
const currentPlan: "STARTER" | "PRO" | "SCALE" = "STARTER";

export function Topbar() {
  const router = useRouter();
  const [displayStoreName, setDisplayStoreName] = useState("My Store");

  useEffect(() => {
    const storedName = localStorage.getItem("storeName");
    if (storedName) {
      setDisplayStoreName(storedName);
    }
  }, []);

  const handleLogout = () => {
    // TODO: Replace with real logout logic (clear session, tokens, etc.)
    // For now, just redirect to login page
    router.push("/login");
  };

  const badge = PLAN_BADGES[currentPlan];

  return (
    <div className="flex h-16 items-center justify-between glass border-b border-border px-6 shadow-sm bg-white/80 backdrop-blur dark:bg-[#0c0e16] dark:border-white/5">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        {/* Store Name */}
        <div className="text-sm font-medium text-foreground">
          {displayStoreName}
        </div>
        
        {/* Messages Dropdown */}
        <MessagesDropdown />
        
        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative h-10 w-10 rounded-full hover:scale-105 transition-transform duration-200 border-2 border-border hover:border-primary dark:border-white/10 dark:hover:border-white/20"
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border-border shadow-lg">
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuLabel className="flex items-center gap-2">
              <span className="text-base">{badge.emoji}</span>
              <span className="text-xs text-muted-foreground">Current plan</span>
              <Badge variant={badge.variant} className={cn("ml-auto", badge.color)}>
                {badge.label}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/app/pricing" className="flex items-center cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Manage plan</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings" className="flex items-center cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings" className="flex items-center cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
