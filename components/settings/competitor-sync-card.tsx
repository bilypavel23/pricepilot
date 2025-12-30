"use client";

import { useState, useEffect } from "react";
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
import { supabase } from "@/lib/supabaseClient";

type Props = {
  planLabel: string;
  syncsPerDay: number;
  initialTimezone: string | null;
  initialTimes: string[] | null;
  storeId?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
  lastCompetitorSyncAt?: string | null;
  lastCompetitorSyncStatus?: string | null;
  lastCompetitorSyncUpdatedCount?: number | null;
};

/**
 * Formats a timestamp for "Last sync" display
 * Format: "DD. MM. YYYY · HH:MM" or "Today · HH:MM" if date is today
 */
function formatLastSync(timestamp: string | null): string {
  if (!timestamp) {
    return "Never";
  }

  try {
    // Parse the timestamp (handles ISO format and other formats)
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Never";
    }

    // Check if date is today (compare only date part, ignore time)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const syncDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = syncDate.getTime() === today.getTime();

    if (isToday) {
      // Format as "Today · HH:MM"
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `Today · ${hours}:${minutes}`;
    } else {
      // Format as "DD. MM. YYYY · HH:MM"
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}. ${month}. ${year} · ${hours}:${minutes}`;
    }
  } catch (error) {
    console.error("[formatLastSync] Error formatting timestamp:", error);
    return "Never";
  }
}

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
  lastCompetitorSyncAt,
  lastCompetitorSyncStatus,
  lastCompetitorSyncUpdatedCount,
}: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initialTimezone || "Europe/Prague");
  const [times, setTimes] = useState<string[]>(
    initialTimes && initialTimes.length > 0 ? initialTimes : syncsPerDay > 0 ? ["06:00"] : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const isReadOnly = syncsPerDay <= 0;

  const maxSlots = Math.min(syncsPerDay, 2); // Enforce max 2 times

  // Get timezone label for display
  const getTimezoneLabel = (ianaValue: string): string => {
    const option = TIMEZONE_OPTIONS.find(opt => opt.value === ianaValue);
    return option?.label || ianaValue;
  };

  // Sync state when props change (e.g., after refetch)
  useEffect(() => {
    if (initialTimezone) {
      setTimezone(initialTimezone);
    }
    if (initialTimes && initialTimes.length > 0) {
      setTimes(initialTimes);
    }
  }, [initialTimezone, initialTimes]);

  const handleTimeChange = (index: number, value: string) => {
    const next = [...times];
    next[index] = value;
    setTimes(next);
  };

  const handleAddTime = () => {
    if (times.length >= maxSlots) return;
    setTimes([...times, "06:00"]);
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
      if (!storeId) {
        onSaveError?.("Store ID is missing. Please refresh the page.");
        setIsSaving(false);
        return;
      }

      // Validate and prepare times: ensure "HH:mm" format, unique, sorted, max 2
      const trimmedTimes = times
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      
      // Format times to ensure "HH:mm" with zero-padding
      const formattedTimes = trimmedTimes.map((t) => {
        const parts = t.split(":");
        if (parts.length !== 2) return null;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          return null;
        }
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }).filter((t): t is string => t !== null);
      
      // Remove duplicates
      const uniqueTimes = Array.from(new Set(formattedTimes));
      
      // Sort ascending
      const sortedTimes = uniqueTimes.sort((a, b) => {
        const [aH, aM] = a.split(":").map(Number);
        const [bH, bM] = b.split(":").map(Number);
        const aMinutes = aH * 60 + aM;
        const bMinutes = bH * 60 + bM;
        return aMinutes - bMinutes;
      });
      
      // Limit to maxSlots (max 2)
      const finalTimes = sortedTimes.slice(0, maxSlots);

      // Send timezone value (can be either IANA or label - API will normalize)
      const timezoneValue = timezone; // Already IANA format from state

      const res = await fetch(`/api/stores/${storeId}/sync-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: timezoneValue,
          daily_sync_times: finalTimes,
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Failed to save:", responseData);
        const errorMsg = responseData.error || "Failed to save competitor sync settings";
        onSaveError?.(errorMsg);
        setIsSaving(false);
        return;
      }

      // Refetch settings and rehydrate UI state without remounting
      const { data: refreshed, error: fetchError } = await supabase
        .from("store_sync_settings")
        .select("timezone, daily_sync_times")
        .eq("store_id", storeId)
        .maybeSingle();

      if (fetchError) {
        console.error("Failed to refetch settings:", fetchError);
        // Still show success since save succeeded, but log the refetch error
      }

      if (refreshed) {
        // Update local state with refreshed data from DB
        setTimezone(refreshed.timezone);
        setTimes(refreshed.daily_sync_times || []);
      }

      // Only show success toast if save succeeded (res.ok was true)
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
        {/* Last competitor sync status */}
        <div className="mb-6 space-y-2 pb-6 border-b border-border">
          <div className="text-xs text-muted-foreground">
            Last competitor sync: {formatLastSync(lastCompetitorSyncAt || null)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            {(() => {
              // Normalize updatedCount to safe number
              const updatedCount = lastCompetitorSyncUpdatedCount ?? 0;
              
              // Determine status and color based on logic
              let statusText: string;
              let statusColor: string;
              
              if (!lastCompetitorSyncAt || lastCompetitorSyncAt === null) {
                statusText = "Never";
                statusColor = "text-gray-600 dark:text-gray-400";
              } else if (
                lastCompetitorSyncStatus === "ok" ||
                updatedCount > 0
              ) {
                statusText = "OK";
                statusColor = "text-green-600 dark:text-green-400";
              } else if (lastCompetitorSyncStatus === "partial") {
                statusText = "Partial";
                statusColor = "text-yellow-600 dark:text-yellow-400";
              } else if (lastCompetitorSyncStatus === "error") {
                statusText = "Failed";
                statusColor = "text-red-600 dark:text-red-400";
              } else if (updatedCount >= 0) {
                statusText = "OK";
                statusColor = "text-green-600 dark:text-green-400";
              } else {
                statusText = "Unknown";
                statusColor = "text-gray-600 dark:text-gray-400";
              }
              
              return (
                <span className={cn("text-xs font-medium", statusColor)}>
                  {statusText}
                </span>
              );
            })()}
          </div>
          {(() => {
            const updatedCount = lastCompetitorSyncUpdatedCount ?? 0;
            return updatedCount > 0 && (
              <div className="text-xs text-muted-foreground">
                Updated prices: {updatedCount}
              </div>
            );
          })()}
        </div>
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
                          size="sm"
                          className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0"
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




