"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
  planLabel: string;
  syncsPerDay: number;
  initialTimezone: string | null;
  initialTimes: string[] | null;
};

const COMMON_TIMEZONES = [
  "Europe/Prague",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
];

export function CompetitorSyncCard({
  planLabel,
  syncsPerDay,
  initialTimezone,
  initialTimes,
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

      const res = await fetch("/api/settings/competitor-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          times: trimmedTimes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Failed to save:", data);
        alert("Failed to save competitor sync settings");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Error saving competitor sync settings:", err);
      alert("Failed to save competitor sync settings");
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
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full md:w-64">
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
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



