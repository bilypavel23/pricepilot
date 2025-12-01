"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const SheetContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export function Sheet({ open: controlledOpen, onOpenChange, children }: SheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? (controlledOpen ?? false) : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      } else {
        setInternalOpen(value);
      }
    },
    [isControlled, onOpenChange]
  );

  const trigger = React.useMemo(() => {
    return React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.type === SheetTrigger
    );
  }, [children]);

  const content = React.useMemo(() => {
    return React.Children.toArray(children).filter(
      (child) => !(React.isValidElement(child) && child.type === SheetTrigger)
    );
  }, [children]);

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {trigger}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50">
            {content}
          </div>
        </>
      )}
    </SheetContext.Provider>
  );
}

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 flex-shrink-0", className)} {...props} />
);

const SheetTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold", className)} {...props} />
);

const SheetDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const SheetContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col h-full w-full max-w-md bg-white dark:bg-[#0f1117] border-l border-slate-200 dark:border-white/10 shadow-[0_18px_45px_rgba(15,23,42,0.18)] dark:shadow-black/40 overflow-hidden relative", className)} {...props}>
    {children}
  </div>
);

const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild, children, onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(true);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: handleClick,
      ...props,
    } as any);
  }
  return (
    <button
      ref={ref}
      className={cn(className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = ({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { setOpen } = React.useContext(SheetContext);
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(false);
    onClick?.(e);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("absolute right-4 top-4 z-10", className)}
      onClick={handleClick}
      {...props}
    >
      <X className="h-4 w-4" />
    </Button>
  );
};

export { SheetHeader, SheetTitle, SheetDescription, SheetContent, SheetClose, SheetTrigger };
