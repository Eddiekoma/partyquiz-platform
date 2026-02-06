"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take last character
    setCode(newCode);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every((digit) => digit) && value) {
      handleSubmit(newCode.join(""));
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
      const newCode = pastedData.split("");
      setCode(newCode);
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (verificationCode?: string) => {
    const codeToSubmit = verificationCode || code.join("");
    if (codeToSubmit.length !== 6) {
      setError("Voer alle 6 cijfers in");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeToSubmit }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verificatie mislukt");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      setSuccess(true);
      
      // Auto sign in after verification
      setTimeout(async () => {
        await signIn("credentials", {
          email,
          password: "", // Will need to sign in manually
          redirect: false,
        });
        router.push("/auth/signin?verified=true");
      }, 2000);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");

    try {
      // Re-register to get a new code
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "resend-only" }),
      });

      if (res.ok) {
        setError("");
        alert("Nieuwe code verzonden naar je email!");
      }
    } catch {
      setError("Kon geen nieuwe code verzenden");
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-slate-100 font-display">
              Email Geverifieerd!
            </h1>
            <p className="text-slate-400">
              Je account is geactiveerd. Je wordt doorgestuurd naar de login pagina...
            </p>
            <div className="animate-pulse text-blue-400">Doorsturen...</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
        <div className="text-center space-y-2 mb-8">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="text-3xl font-bold text-slate-100 font-display">
            Verifieer je Email
          </h1>
          <p className="text-slate-400">
            We hebben een 6-cijferige code gestuurd naar
          </p>
          <p className="text-blue-400 font-medium">{email}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              className="w-12 h-14 text-center text-2xl font-bold bg-slate-800/50 border-2 border-slate-600/50 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none transition disabled:opacity-50"
            />
          ))}
        </div>

        <Button
          onClick={() => handleSubmit()}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-full"
          loading={loading}
          disabled={loading || code.join("").length !== 6}
        >
          Verifiëren
        </Button>

        <div className="text-center text-sm text-slate-400 mt-6">
          Geen code ontvangen?{" "}
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50"
          >
            {resending ? "Verzenden..." : "Opnieuw verzenden"}
          </button>
        </div>

        <div className="text-center text-sm text-slate-500 mt-4">
          <Link href="/auth/signin" className="hover:text-slate-400">
            ← Terug naar inloggen
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Laden...</div>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
