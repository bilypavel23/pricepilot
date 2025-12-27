"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, onClick, onPointerDown, onKeyDown, ...props }, ref) => {
    const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      // Stop propagation to prevent form submission, but don't preventDefault to allow checkbox toggle
      e.stopPropagation();
      onClick?.(e as any);
    };

    const handleLabelPointerDown = (e: React.PointerEvent<HTMLLabelElement>) => {
      // Stop propagation to prevent form submission, but don't preventDefault to allow checkbox toggle
      e.stopPropagation();
      onPointerDown?.(e as any);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Stop propagation to prevent form submission
      e.stopPropagation();
      onCheckedChange?.(e.target.checked);
    };

    const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
      // Stop propagation to prevent form submission
      e.stopPropagation();
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent form submission for Enter/Space, but still allow toggle via checkbox behavior
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation();
      }
      onKeyDown?.(e as any);
    };

    return (
      <label 
        className="inline-flex items-center cursor-pointer"
        onClick={handleLabelClick}
        onPointerDown={handleLabelPointerDown}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleInputKeyDown}
          ref={ref}
          {...props}
        />
        <div
          className={cn(
            "relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 transition-all duration-300",
            checked && "bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700",
            className
          )}
        >
          <div
            className={cn(
              "absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all duration-300 shadow-sm",
              checked && "transform translate-x-5"
            )}
          />
        </div>
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
