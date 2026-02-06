"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

function SetPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // We use the same forgot-password endpoint - it works for both cases
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
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px]" />
        </div>
        <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">🔐</div>
            <h1 className="text-3xl font-bold text-slate-100 font-display">
              Check je Email!
            </h1>
            <p className="text-slate-400">
              We hebben een link gestuurd waarmee je een wachtwoord kunt instellen voor je account.
            </p>
            <p className="text-blue-400 font-medium">{email}</p>
            <p className="text-sm text-slate-500">
              Na het instellen van je wachtwoord kun je inloggen met zowel Google als email/wachtwoord.
            </p>
            <div className="pt-4">
              <Link
                href="/auth/signin"
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
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
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[128px]" />
      </div>

      <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
        <div className="text-center space-y-2 mb-8">
          <div className="mb-4">
            <span className="font-display text-2xl font-bold gradient-text">PartyQuiz</span>
            <span className="ml-2 text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded-md">by Databridge360</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-100 font-display">
            Wachtwoord Instellen
          </h1>
          <p className="text-slate-400">
            Je account heeft nog geen wachtwoord. Voer je email in om een wachtwoord in te stellen.
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-300">
              Na het instellen van een wachtwoord kun je kiezen om in te loggen met <strong>Google</strong> of met <strong>email/wachtwoord</strong>.
            </p>
          </div>
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
            placeholder="jouw@email.com"
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
            Wachtwoord Link Versturen
          </Button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-slate-400">
            Of log direct in met Google
          </p>
          <Link 
            href="/auth/signin" 
            className="block w-full btn btn-secondary"
          >
            Terug naar Inloggen
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  );
}
