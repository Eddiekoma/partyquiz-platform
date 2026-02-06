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
        setError(data.error || "Er ging iets mis");
        return;
      }

      setSent(true);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">✉️</div>
            <h1 className="text-3xl font-bold text-slate-100 font-display">
              Check je Email!
            </h1>
            <p className="text-slate-400">
              Als dit emailadres bij ons bekend is, ontvang je een email met instructies om je wachtwoord te resetten.
            </p>
            <p className="text-blue-400 font-medium">{email}</p>
            <div className="pt-4">
              <Link
                href="/auth/signin"
                className="text-sm text-slate-400 hover:text-slate-300"
              >
                ← Terug naar inloggen
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
        <div className="text-center space-y-2 mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-slate-100 font-display">
            Wachtwoord Vergeten?
          </h1>
          <p className="text-slate-400">
            Geen probleem! Voer je email in en we sturen je een reset link.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="jouw@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            required
            autoComplete="email"
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-full"
            loading={loading}
            disabled={!email || loading}
          >
            Reset Link Versturen
          </Button>
        </form>

        <div className="text-center text-sm text-slate-400 mt-6">
          Weet je je wachtwoord weer?{" "}
          <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300 font-medium">
            Inloggen
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Laden...</div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
