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
      setError("Invalid reset link. Please request a new one.");
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
      setError("Please enter all 6 digits");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
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
        setError(data.error || "Could not reset password");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/auth/signin");
      }, 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/20 rounded-full blur-[128px]" />
        </div>
        <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-5xl sm:text-6xl">✅</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display">
              Password Changed!
            </h1>
            <p className="text-slate-400">
              Your password has been successfully changed. You will be redirected to the login page...
            </p>
            <div className="spinner mx-auto"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-red-500/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-purple-500/20 rounded-full blur-[128px]" />
        </div>
        <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-5xl sm:text-6xl">❌</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display">
              Invalid Link
            </h1>
            <p className="text-slate-400">
              This reset link is invalid or expired. Please request a new one.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block btn btn-primary"
            >
              Request New Link
            </Link>
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
            New Password
          </h1>
          <p className="text-slate-400">
            Enter the code from your email and choose a new password
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">
              Verification Code
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
                  className="w-12 h-14 text-center text-2xl font-bold glass border-2 border-[rgba(148,163,184,0.2)] rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                />
              ))}
            </div>
          </div>

          <Input
            id="password"
            type="password"
            label="New Password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            required
            autoComplete="new-password"
            className="input"
          />

          <Input
            id="confirmPassword"
            type="password"
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            required
            autoComplete="new-password"
            className="input"
          />

          <div className="text-xs text-slate-500 space-y-1">
            <p>Password requirements:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li className={password.length >= 8 ? "text-emerald-400" : ""}>
                Minimum 8 characters
              </li>
              <li className={/[A-Z]/.test(password) ? "text-emerald-400" : ""}>
                At least 1 uppercase letter
              </li>
              <li className={/[a-z]/.test(password) ? "text-emerald-400" : ""}>
                At least 1 lowercase letter
              </li>
              <li className={/[0-9]/.test(password) ? "text-emerald-400" : ""}>
                At least 1 number
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full btn btn-primary btn-lg"
            loading={loading}
            disabled={loading || code.join("").length !== 6}
          >
            Change Password
          </Button>
        </form>

        <div className="text-center text-sm text-slate-500 mt-6">
          <Link href="/auth/signin" className="hover:text-cyan-400 transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
