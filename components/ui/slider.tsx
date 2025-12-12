"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  min?: number;
  max?: number;
  step?: number;
  value?: number | number[];
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, value, onValueChange, ...props }, ref) => {
    // Support both single number and array format
    const valueArray = Array.isArray(value) ? value : value !== undefined ? [value] : [min];
    const currentValue = valueArray[0];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (onValueChange) {
        onValueChange([newValue]);
      }
    };

    const range = max - min;
    const percentage = ((currentValue - min) / range) * 100;

    return (
      <div className="relative w-full">
        {/* Grey track background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg pointer-events-none" />
        {/* Blue filled range */}
        <div
          className="absolute top-0 left-0 h-2 bg-blue-500 rounded-lg pointer-events-none z-10"
          style={{ width: `${percentage}%` }}
        />
        {/* Slider input */}
        <input
          type="range"
          ref={ref}
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          className={cn(
            "relative z-20 w-full h-2 bg-transparent appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:block [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white dark:[&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:focus:outline-none [&::-webkit-slider-thumb]:focus-visible:ring-2 [&::-webkit-slider-thumb]:focus-visible:ring-primary/40",
            "[&::-moz-range-thumb]:block [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white dark:[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:focus:outline-none [&::-moz-range-thumb]:focus-visible:ring-2 [&::-moz-range-thumb]:focus-visible:ring-primary/40",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };

