"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/20 rounded-full blur-[128px]" />
        </div>
        <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-5xl sm:text-6xl">✉️</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display">
              Check Your Email!
            </h1>
            <p className="text-slate-400">
              If this email address is registered with us, you will receive an email with instructions to reset your password.
            </p>
            <p className="text-blue-400 font-medium">{email}</p>
            <div className="pt-4">
              <Link
                href="/auth/signin"
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-purple-500/10 rounded-full blur-[128px]" />
      </div>

      <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
        <div className="text-center space-y-2 mb-8">
          <div className="mb-4">
            <span className="font-display text-2xl font-bold gradient-text">PartyQuiz</span>
            <span className="ml-2 text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded-md">by Databridge360</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display">
            Forgot Password?
          </h1>
          <p className="text-slate-400">
            No problem! Enter your email and we'll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            required
            autoComplete="email"
            className="input"
          />

          <Button
            type="submit"
            className="w-full btn btn-primary btn-lg"
            loading={loading}
            disabled={!email || loading}
          >
            Send Reset Link
          </Button>
        </form>

        <div className="text-center text-sm text-slate-400 mt-6">
          Remember your password?{" "}
          <Link href="/auth/signin" className="text-blue-400 hover:text-cyan-400 font-medium transition-colors">
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
