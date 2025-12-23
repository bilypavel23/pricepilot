"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
  planLabel: string;
  syncsPerDay: number;
  initialTimezone: string | null;
  initialTimes: string[] | null;
  storeId?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
};

type TimezoneOption = {
  value: string;
  label: string;
  group: string;
};

const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // EUROPE
  { value: "Europe/Prague", label: "Europe — Prague", group: "Europe" },
  { value: "Europe/Berlin", label: "Europe — Berlin", group: "Europe" },
  { value: "Europe/Vienna", label: "Europe — Vienna", group: "Europe" },
  { value: "Europe/Warsaw", label: "Europe — Warsaw", group: "Europe" },
  { value: "Europe/Budapest", label: "Europe — Budapest", group: "Europe" },
  { value: "Europe/Paris", label: "Europe — Paris", group: "Europe" },
  { value: "Europe/Rome", label: "Europe — Rome", group: "Europe" },
  { value: "Europe/Madrid", label: "Europe — Madrid", group: "Europe" },
  { value: "Europe/Amsterdam", label: "Europe — Amsterdam", group: "Europe" },
  { value: "Europe/Brussels", label: "Europe — Brussels", group: "Europe" },
  { value: "Europe/Stockholm", label: "Europe — Stockholm", group: "Europe" },
  { value: "Europe/Copenhagen", label: "Europe — Copenhagen", group: "Europe" },
  { value: "Europe/Oslo", label: "Europe — Oslo", group: "Europe" },
  { value: "Europe/Helsinki", label: "Europe — Helsinki", group: "Europe" },
  { value: "Europe/Dublin", label: "Europe — Dublin", group: "Europe" },
  { value: "Europe/Lisbon", label: "Europe — Lisbon", group: "Europe" },
  { value: "Europe/London", label: "Europe — London", group: "Europe" },
  { value: "Europe/Zurich", label: "Europe — Zurich", group: "Europe" },
  { value: "Europe/Athens", label: "Europe — Athens", group: "Europe" },
  { value: "Europe/Istanbul", label: "Europe — Istanbul", group: "Europe" },
  { value: "Europe/Kyiv", label: "Europe — Kyiv", group: "Europe" },
  { value: "Europe/Bucharest", label: "Europe — Bucharest", group: "Europe" },
  // USA + CANADA
  { value: "America/New_York", label: "America — New York (ET)", group: "USA + Canada" },
  { value: "America/Detroit", label: "America — Detroit (ET)", group: "USA + Canada" },
  { value: "America/Chicago", label: "America — Chicago (CT)", group: "USA + Canada" },
  { value: "America/Winnipeg", label: "America — Winnipeg (CT)", group: "USA + Canada" },
  { value: "America/Denver", label: "America — Denver (MT)", group: "USA + Canada" },
  { value: "America/Edmonton", label: "America — Edmonton (MT)", group: "USA + Canada" },
  { value: "America/Phoenix", label: "America — Phoenix (AZ / no DST)", group: "USA + Canada" },
  { value: "America/Los_Angeles", label: "America — Los Angeles (PT)", group: "USA + Canada" },
  { value: "America/Vancouver", label: "America — Vancouver (PT)", group: "USA + Canada" },
  { value: "America/Anchorage", label: "America — Anchorage (AK)", group: "USA + Canada" },
  { value: "Pacific/Honolulu", label: "Pacific — Honolulu (HI)", group: "USA + Canada" },
  { value: "America/Halifax", label: "America — Halifax (Atlantic)", group: "USA + Canada" },
  { value: "America/St_Johns", label: "America — St. John's (Newfoundland)", group: "USA + Canada" },
  { value: "America/Toronto", label: "America — Toronto (Canada ET)", group: "USA + Canada" },
  { value: "America/Montreal", label: "America — Montreal (Canada ET)", group: "USA + Canada" },
  { value: "America/Calgary", label: "America — Calgary (Canada MT)", group: "USA + Canada" },
  // UTC
  { value: "UTC", label: "UTC", group: "UTC" },
];

export function CompetitorSyncCard({
  planLabel,
  syncsPerDay,
  initialTimezone,
  initialTimes,
  storeId,
  onSaveSuccess,
  onSaveError,
}: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initialTimezone || "Europe/Prague");
  const [times, setTimes] = useState<string[]>(
    initialTimes && initialTimes.length > 0 ? initialTimes : syncsPerDay > 0 ? ["09:00"] : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const isReadOnly = syncsPerDay <= 0;

  const maxSlots = syncsPerDay;

  const handleTimeChange = (index: number, value: string) => {
    const next = [...times];
    next[index] = value;
    setTimes(next);
  };

  const handleAddTime = () => {
    if (times.length >= maxSlots) return;
    setTimes([...times, "09:00"]);
  };

  const handleRemoveTime = (index: number) => {
    const next = [...times];
    next.splice(index, 1);
    setTimes(next);
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    setIsSaving(true);
    try {
      const trimmedTimes = times
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, maxSlots);

      if (!storeId) {
        alert("Store ID is missing. Please refresh the page.");
        return;
      }

      const res = await fetch(`/api/stores/${storeId}/sync-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          daily_sync_times: trimmedTimes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Failed to save:", data);
        const errorMsg = data.error || "Failed to save competitor sync settings";
        onSaveError?.(errorMsg);
        setIsSaving(false);
        return;
      }

      router.refresh();
      onSaveSuccess?.();
    } catch (err: any) {
      console.error("Error saving competitor sync settings:", err);
      onSaveError?.(err.message || "Failed to save competitor sync settings");
    } finally {
      setIsSaving(false);
    }
  };

  const planInfo =
    syncsPerDay === 0
      ? `${planLabel} plan – competitor sync scheduling is available on Starter and above.`
      : `${planLabel} plan – up to ${syncsPerDay} sync${syncsPerDay > 1 ? "s" : ""} per day.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Competitor sync</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Control how often we sync competitor prices for your store.
        </CardDescription>
        <p className="mt-2 text-xs text-muted-foreground/80">{planInfo}</p>
      </CardHeader>
      <CardContent>
        {isReadOnly ? (
          <p className="text-sm text-muted-foreground">
            Upgrade your plan to configure automatic competitor sync times.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Europe", "USA + Canada", "UTC"].map((groupName) => (
                      <SelectGroup key={groupName}>
                        <SelectLabel>{groupName}</SelectLabel>
                        {TIMEZONE_OPTIONS.filter((opt) => opt.group === groupName).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Daily sync time{maxSlots > 1 ? "s" : ""}{" "}
                  <span className="normal-case text-[11px] text-muted-foreground">
                    (max {maxSlots} per day)
                  </span>
                </Label>
                <div className="space-y-2">
                  {times.map((time, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        className="w-32"
                      />
                      {times.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-red-400 h-8 w-8"
                          onClick={() => handleRemoveTime(index)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {times.length < maxSlots && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={handleAddTime}
                  >
                    + Add another time
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleSave} disabled={isSaving} className="px-5">
                {isSaving ? "Saving…" : "Save sync settings"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}




