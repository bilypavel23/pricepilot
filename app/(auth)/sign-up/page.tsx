"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  const router = useRouter();
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

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
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">Create an account</CardTitle>
          <CardDescription className="text-slate-400">
            Get started with PricePilot today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-300">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
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
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                Must be at least 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" className="text-slate-300">
                Confirm password
              </Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                className="bg-slate-800 border-slate-700 text-white"
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
            
            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                {error}
              </div>
            )}
            
            {message && (
              <div className="text-sm text-green-400 bg-green-900/20 border border-green-800 rounded p-2">
                {message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              disabled={loading || !termsAccepted}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

