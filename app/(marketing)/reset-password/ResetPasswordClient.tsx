"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  // Check if we have a valid reset token and exchange hash for session
  useEffect(() => {
    const checkToken = async () => {
      const supabase = createClient();
      
      // Check if we have hash params in the URL (Supabase adds these)
      const hashParams = window.location.hash;
      if (hashParams && hashParams.includes("access_token")) {
        // Exchange the hash for a session
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Session error:", error);
          setIsValidToken(false);
          return;
        }
        
        // If we have a session, token is valid
        if (data.session) {
          setIsValidToken(true);
        } else {
          setIsValidToken(false);
        }
      } else {
        // Check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidToken(true);
        } else {
          setIsValidToken(false);
        }
      }
    };

    checkToken();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Update password error:", updateError);
        
        // Handle invalid/expired token
        if (updateError.message.includes("token") || updateError.message.includes("expired") || updateError.message.includes("invalid")) {
          setError("This reset link is invalid or has expired. Please request a new one.");
          setIsValidToken(false);
        } else {
          setError(updateError.message || "Failed to update password");
        }
        setIsLoading(false);
        return;
      }

      // Success - redirect to login
      router.push("/login?password_reset=success");
    } catch (err: any) {
      console.error("Reset password exception:", err);
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  // Show loading state while checking token
  if (isValidToken === null) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50">
          <CardContent className="py-8">
            <p className="text-center text-slate-300">Verifying reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if token is invalid
  if (isValidToken === false) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-white">Invalid or expired link</CardTitle>
            <CardDescription className="text-slate-400">
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Password reset links expire after 1 hour. Please request a new one.
              </p>
              <div className="flex gap-3">
                <Button
                  asChild
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Link href="/forgot-password">Request new link</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Link href="/login">Back to login</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">Set new password</CardTitle>
          <CardDescription className="text-slate-400">
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">Must be at least 8 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update password"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-400">
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

