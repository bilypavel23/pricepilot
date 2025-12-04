"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email || !password) {
        setError("Please enter both email and password");
        setLoading(false);
        return;
      }
      
      // Create Supabase client with cookie support
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError("No session received. Please try again.");
        setLoading(false);
        return;
      }

      // Force a full page reload to ensure cookies are available server-side
      window.location.href = "/app/dashboard";
    } catch (err: any) {
      console.error("Sign in exception:", err);
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to your PricePilot account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form 
            onSubmit={(e) => {
              console.log("=== FORM SUBMIT EVENT ===");
              e.preventDefault();
              handleSubmit(e);
            }} 
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <Link
                  href="#"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              disabled={loading}
              onClick={(e) => {
                console.log("Button clicked!");
                console.log("Form valid:", e.currentTarget.form?.checkValidity());
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link href="/sign-up" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

