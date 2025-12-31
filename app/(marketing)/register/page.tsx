"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function RegisterPage() {

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  // PRO JISTOTU: při otevření /register se odhlaš z jakékoliv staré session
  useEffect(() => {
    const logout = async () => {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await supabase.auth.signOut();
        console.log("Signed out old session on /register");
      }
    };
    logout();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setTermsError(null);

    if (!termsAccepted) {
      setTermsError("You must agree to continue.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          termsAccepted,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message ?? data.error ?? "Unknown DB error";
        setError(errorMessage);
        if (errorMessage.includes("Terms of Service")) {
          setTermsError(errorMessage);
        }
        return;
      }

      setMessage(
        "Account created. Please check your email and click the verification link to activate your account."
      );
    } catch (err: any) {
      console.error("SIGNUP EXCEPTION", err);
      setError(err.message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <form
        onSubmit={handleSignUp}
        className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-xl"
      >
        <h1 className="text-2xl font-semibold mb-1">Create an account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Get started with PricePilot today.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm mb-1 block">Full name</label>
            <Input
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm mb-1 block">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm mb-1 block">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <label className="text-sm mb-1 block">Confirm password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => {
                  setTermsAccepted(checked === true);
                  setTermsError(null);
                }}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm text-slate-300 leading-relaxed cursor-pointer">
                I agree with the{" "}
                <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {termsError && (
              <p className="text-sm text-red-400">{termsError}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 text-sm text-emerald-400">
            {message}
          </p>
        )}

        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={loading || !termsAccepted}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </div>
  );
}

