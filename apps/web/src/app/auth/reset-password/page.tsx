"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!token) {
      setError("Ongeldige reset link. Vraag een nieuwe aan.");
    }
    inputRefs.current[0]?.focus();
  }, [token]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      setCode(pastedData.split(""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const verificationCode = code.join("");
    if (verificationCode.length !== 6) {
      setError("Voer alle 6 cijfers in");
      return;
    }

    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }

    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens bevatten");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: verificationCode, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kon wachtwoord niet resetten");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/auth/signin");
      }, 3000);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-slate-100 font-display">
              Wachtwoord Gewijzigd!
            </h1>
            <p className="text-slate-400">
              Je wachtwoord is succesvol gewijzigd. Je wordt doorgestuurd naar de login pagina...
            </p>
            <div className="animate-pulse text-blue-400">Doorsturen...</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <h1 className="text-3xl font-bold text-slate-100 font-display">
              Ongeldige Link
            </h1>
            <p className="text-slate-400">
              Deze reset link is ongeldig of verlopen. Vraag een nieuwe aan.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 px-6 rounded-full transition"
            >
              Nieuwe Link Aanvragen
            </Link>
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
            Nieuw Wachtwoord
          </h1>
          <p className="text-slate-400">
            Voer de code uit je email in en kies een nieuw wachtwoord
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">
              Verificatiecode
            </label>
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={loading}
                  className="w-12 h-14 text-center text-2xl font-bold bg-slate-800/50 border-2 border-slate-600/50 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none transition disabled:opacity-50"
                />
              ))}
            </div>
          </div>

          <Input
            id="password"
            type="password"
            label="Nieuw Wachtwoord"
            placeholder="Minimaal 8 tekens"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            required
            autoComplete="new-password"
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <Input
            id="confirmPassword"
            type="password"
            label="Bevestig Wachtwoord"
            placeholder="Herhaal je wachtwoord"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            required
            autoComplete="new-password"
            className="bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder:text-slate-500"
          />

          <div className="text-xs text-slate-500 space-y-1">
            <p>Wachtwoord vereisten:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li className={password.length >= 8 ? "text-green-400" : ""}>
                Minimaal 8 tekens
              </li>
              <li className={/[A-Z]/.test(password) ? "text-green-400" : ""}>
                Minimaal 1 hoofdletter
              </li>
              <li className={/[a-z]/.test(password) ? "text-green-400" : ""}>
                Minimaal 1 kleine letter
              </li>
              <li className={/[0-9]/.test(password) ? "text-green-400" : ""}>
                Minimaal 1 cijfer
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-full"
            loading={loading}
            disabled={loading || code.join("").length !== 6}
          >
            Wachtwoord Wijzigen
          </Button>
        </form>

        <div className="text-center text-sm text-slate-500 mt-6">
          <Link href="/auth/signin" className="hover:text-slate-400">
            ← Terug naar inloggen
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Laden...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
