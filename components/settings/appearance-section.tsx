"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface AppearanceSectionProps {
  mounted: boolean;
  theme: string | undefined;
  onThemeChange: (value: "light" | "dark" | "system") => void;
}

export const AppearanceSection = memo(function AppearanceSection({
  mounted,
  theme,
  onThemeChange,
}: AppearanceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance</CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Choose how PricePilot looks on your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mounted && (
          <RadioGroup
            value={theme === "system" ? "system" : theme}
            onValueChange={(value) => {
              onThemeChange(value as "light" | "dark" | "system");
            }}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="light" id="theme-light" />
              <Label htmlFor="theme-light" className="text-sm font-medium cursor-pointer">
                Light
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="dark" id="theme-dark" />
              <Label htmlFor="theme-dark" className="text-sm font-medium cursor-pointer">
                Dark
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="system" id="theme-system" />
              <Label htmlFor="theme-system" className="text-sm font-medium cursor-pointer">
                System
              </Label>
            </div>
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
});



