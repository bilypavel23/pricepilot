"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  side: "top" | "bottom" | "left" | "right";
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

// TooltipProvider - wrapper component for shadcn/ui compatibility
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

interface TooltipProps {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, side = "top" }: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ isOpen, setIsOpen, side }}>
      <div
        className="relative inline-block"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ asChild, children, ...props }: { asChild?: boolean; children: React.ReactNode; [key: string]: any }) {
  return <div {...props}>{children}</div>;
}

export function TooltipContent({ children, side, className, ...props }: { children: React.ReactNode; side?: "top" | "bottom" | "left" | "right"; className?: string; [key: string]: any }) {
  const context = React.useContext(TooltipContext);
  if (!context || !context.isOpen) return null;
  
  const actualSide = side || context.side;

  return (
    <div
      className={cn(
        "absolute z-50 px-3 py-1.5 text-xs text-white bg-neutral-900 rounded-md shadow-lg border border-white/10 whitespace-normal",
        actualSide === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
        actualSide === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
        actualSide === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
        actualSide === "right" && "left-full top-1/2 -translate-y-1/2 ml-2",
        className
      )}
    >
      {children}
      <div
        className={cn(
          "absolute w-2 h-2 bg-neutral-900 border border-white/10 rotate-45",
          actualSide === "top" && "top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-0 border-r-0",
          actualSide === "bottom" && "bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-b-0 border-l-0",
          actualSide === "left" && "left-full top-1/2 -translate-y-1/2 -translate-x-1/2 border-l-0 border-b-0",
          actualSide === "right" && "right-full top-1/2 -translate-y-1/2 translate-x-1/2 border-r-0 border-t-0"
        )}
      />
    </div>
  );
}

