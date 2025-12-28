import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BetaBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400",
        className
      )}
    >
      Beta
    </Badge>
  );
}

