"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title.trim() || !body.trim()) {
      setError("Title and message are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/announcements/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send update");
        return;
      }

      // Success
      setSuccess(true);
      setTitle("");
      setBody("");

      // Show success message for 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error("Error sending announcement:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="announcement-title">Title</Label>
        <Input
          id="announcement-title"
          placeholder="e.g., New Feature: Automated Pricing Rules"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          className="dark:bg-slate-800 dark:border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="announcement-body">Message</Label>
        <Textarea
          id="announcement-body"
          placeholder="Describe the update, new features, or improvements..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isSubmitting}
          rows={6}
          className="dark:bg-slate-800 dark:border-slate-700"
        />
      </div>

      {error && (
        <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
      )}

      {success && (
        <div className="text-sm text-green-500 dark:text-green-400">
          Update sent successfully! All users will see it in their Messages.
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || !title.trim() || !body.trim()}
        className="w-full"
      >
        {isSubmitting ? "Sending..." : "Send update"}
      </Button>
    </form>
  );
}


