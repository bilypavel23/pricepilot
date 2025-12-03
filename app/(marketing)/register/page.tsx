"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // PRO JISTOTU: při otevření /register se odhlaš z jakékoliv staré session
  useEffect(() => {
    const logout = async () => {
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

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: {
            full_name: fullName,
            plan: "free_demo",
          },
        },
      });

      console.log("SIGNUP RESULT", { data, error });

      if (error) {
        setError(error.message);
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
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </div>
  );
}

