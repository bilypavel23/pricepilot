import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg hover:scale-[1.02] dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white dark:shadow-md dark:shadow-blue-700/20": variant === "default",
            "border border-border bg-card hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md hover:scale-[1.02] dark:border-white/20 dark:text-gray-200 dark:hover:border-white/40 dark:hover:bg-white/5": variant === "outline",
            "hover:bg-accent hover:text-accent-foreground dark:hover:bg-white/5 dark:text-gray-200": variant === "ghost",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md hover:scale-[1.02] dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-200": variant === "secondary",
          },
          {
            "h-10 px-4 py-2": size === "default",
            "h-9 px-3 text-xs": size === "sm",
            "h-12 px-8 text-base": size === "lg",
            "h-9 w-9 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
