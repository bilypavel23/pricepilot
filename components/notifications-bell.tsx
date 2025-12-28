"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NotificationsBellProps {
  notificationsCount?: number;
}

export function NotificationsBell({ notificationsCount = 0 }: NotificationsBellProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push("/app/recommendations");
  };

  return (
    <Tooltip side="bottom">
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-9 w-9 p-0"
          aria-label="Notifications"
          onClick={handleClick}
        >
          <Bell className="h-5 w-5" />
          {notificationsCount > 0 && (
            <span className="absolute -top-1 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {notificationsCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Pricing alerts coming soon
      </TooltipContent>
    </Tooltip>
  );
}

