"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  TrendingUp,
  Settings,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/app/products", icon: Package },
  { name: "Competitors", href: "/app/competitors", icon: Users },
  { name: "Recommendations", href: "/app/recommendations", icon: TrendingUp },
  { name: "Settings", href: "/app/settings", icon: Settings },
  { name: "Pricing", href: "/app/pricing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col glass border-r border-border rounded-r-2xl bg-white dark:bg-[#0e111a] dark:border-white/5">
      <div className="flex h-16 items-center border-b border-border dark:border-white/5 px-6">
        <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
          PricePilot
        </h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20 text-blue-600 dark:text-white border-l-4 border-blue-500 shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
              )}
            >
              <item.icon 
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive 
                    ? "text-blue-600 dark:text-white" 
                    : "text-muted-foreground group-hover:text-foreground dark:text-gray-300 dark:group-hover:text-white"
                )} 
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
