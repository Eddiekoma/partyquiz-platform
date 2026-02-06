"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Er ging iets mis");
        return;
      }

      // Redirect to verification page
      router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
        <div className="text-center space-y-2 mb-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-slate-100 font-display">
            Account Aanmaken
          </h1>
          <p className="text-slate-400">
            Maak je gratis PartyQuiz account
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            name="name"
            type="text"
            label="Naam"
            placeholder="Je naam"
            value={formData.name}
            onChange={handleChange}
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="jouw@email.com"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Wachtwoord"
            placeholder="Minimaal 8 tekens"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Bevestig Wachtwoord"
            placeholder="Herhaal je wachtwoord"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <div className="text-xs text-slate-500 space-y-1">
            <p>Wachtwoord vereisten:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li className={formData.password.length >= 8 ? "text-green-400" : ""}>
                Minimaal 8 tekens
              </li>
              <li className={/[A-Z]/.test(formData.password) ? "text-green-400" : ""}>
                Minimaal 1 hoofdletter
              </li>
              <li className={/[a-z]/.test(formData.password) ? "text-green-400" : ""}>
                Minimaal 1 kleine letter
              </li>
              <li className={/[0-9]/.test(formData.password) ? "text-green-400" : ""}>
                Minimaal 1 cijfer
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-full"
            loading={loading}
            disabled={loading}
          >
            Account Aanmaken
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700/50"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-slate-900/80 text-slate-500">of</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-medium py-3 px-4 rounded-full transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Doorgaan met Google
        </button>

        <div className="text-center text-sm text-slate-400 mt-6">
          Heb je al een account?{" "}
          <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300 font-medium">
            Inloggen
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Laden...</div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
