"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

const DropdownMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(({ className, open: controlledOpen, onOpenChange, children, ...props }, ref) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [controlledOpen, onOpenChange]
  );

  // Handle click outside to close menu
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, setOpen]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div
        ref={React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement, []) || containerRef}
        className={cn("relative inline-block text-left", className)}
        {...props}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
});
DropdownMenu.displayName = "DropdownMenu";

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  if (asChild && React.isValidElement(children)) {
    const { asChild: _, ...childProps } = children.props || {};
    const finalProps: any = {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(!open);
        children.props.onClick?.(e);
      },
      ref,
      ...childProps,
    };
    // Explicitly remove asChild from final props
    delete finalProps.asChild;
    return React.cloneElement(children, finalProps);
  }

  const { asChild: _, ...buttonProps } = props;

  return (
    <button
      ref={ref}
      className={cn(className)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    sideOffset?: number;
    align?: "start" | "end" | "center";
  }
>(({ className, sideOffset = 8, align = "end", ...props }, ref) => {
  const { open } = React.useContext(DropdownMenuContext);

  if (!open) return null;

  const { sideOffset: _, align: __, ...domProps } = props;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 min-w-[8rem] rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141823] dark:text-gray-200 p-1 text-popover-foreground shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:shadow-[0_4px_15px_rgba(0,0,0,0.4)]",
        align === "end" && "right-0",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        className
      )}
      style={{
        marginTop: `${sideOffset}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      {...domProps}
    />
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ className, asChild, children, ...props }, ref) => {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent) => {
    props.onClick?.(e);
    // Close menu after item click
    setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    const childElement = children as React.ReactElement<any>;
    const childProps = childElement.props || {};
    const { asChild: _childAsChild, ...safeChildProps } = childProps;
    const { asChild: _parentAsChild, ...safeParentProps } = props;
    
    const finalProps: any = {
      ...safeChildProps,
      ...safeParentProps,
      ref,
      onClick: handleClick,
      className: cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground dark:text-gray-200 dark:hover:bg-white/5 dark:focus:bg-white/5",
        className,
        childProps.className
      ),
    };
    
    delete finalProps.asChild;
    
    return React.cloneElement(childElement, finalProps);
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground dark:text-gray-200 dark:hover:bg-white/5 dark:focus:bg-white/5",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
