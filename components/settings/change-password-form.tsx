"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@supabase/ssr";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err: any) {
      console.error("Error updating password:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Change password</Label>
      </div>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-sm">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            disabled={loading}
            className="dark:bg-[#0f1117] dark:border-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm">
            Confirm new password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            disabled={loading}
            className="dark:bg-[#0f1117] dark:border-white/10"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                handleChangePassword();
              }
            }}
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-500 dark:text-green-400">
            Password updated successfully.
          </p>
        )}
        <div className="flex">
          <Button
            onClick={handleChangePassword}
            disabled={loading || !password || !confirmPassword}
            className="dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {loading ? "Updating..." : "Update password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

