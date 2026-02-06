"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

// Map NextAuth error codes to user-friendly Dutch messages
function getErrorMessage(error: string | null): string {
  if (!error) return "";
  
  const errorMessages: Record<string, string> = {
    // NextAuth built-in errors
    "Configuration": "Er is een probleem met de login configuratie. Neem contact op met support.",
    "AccessDenied": "Toegang geweigerd. Je hebt geen toestemming om in te loggen.",
    "Verification": "De verificatielink is verlopen of al gebruikt.",
    "OAuthSignin": "Fout bij het starten van de Google login.",
    "OAuthCallback": "Fout bij het verwerken van de Google login.",
    "OAuthCreateAccount": "Kon geen account aanmaken met Google.",
    "EmailCreateAccount": "Kon geen account aanmaken met dit emailadres.",
    "Callback": "Er ging iets mis bij het inloggen.",
    "OAuthAccountNotLinked": "Dit emailadres is al in gebruik met een andere inlogmethode.",
    "EmailSignin": "Kon geen magic link verzenden.",
    "CredentialsSignin": "Onjuiste email of wachtwoord.",
    "SessionRequired": "Je moet ingelogd zijn om deze pagina te bekijken.",
    "Default": "Er ging iets mis. Probeer het opnieuw.",
    
    // Custom error codes from our credentials provider
    "email_password_required": "Email en wachtwoord zijn verplicht.",
    "user_not_found": "Geen account gevonden met dit emailadres.",
    "no_password_set": "Dit account heeft nog geen wachtwoord. Stel eerst een wachtwoord in via je accountinstellingen, of log in via Google.",
    "email_not_verified": "Verifieer eerst je email. Check je inbox voor de verificatielink.",
    "invalid_password": "Het wachtwoord is onjuist. Probeer het opnieuw.",
  };

  return errorMessages[error] || `Er ging iets mis: ${error}`;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const verified = searchParams.get("verified") === "true";
  const authError = searchParams.get("error");

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push(callbackUrl);
    }
  }, [status, session, router, callbackUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    );
  }

  const handleMagicLink = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await signIn("email", {
        email: formData.email,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Kon geen magic link verzenden");
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">✉️</div>
            <h1 className="text-3xl font-bold text-slate-100 font-display">
              Check je Email!
            </h1>
            <p className="text-slate-400">
              We hebben een magic link gestuurd naar{" "}
              <strong className="text-blue-400">{formData.email}</strong>
            </p>
            <p className="text-sm text-slate-500">
              Klik op de link in de email om in te loggen. De link is 24 uur geldig.
            </p>
            <Button
              variant="ghost"
              onClick={() => setMagicLinkSent(false)}
              className="mt-4 btn btn-ghost"
            >
              Ander email proberen
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      {/* Background gradient effects */}
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
            Welkom Terug!
          </h1>
          <p className="text-slate-400">
            Log in om je quizzes en workspaces te beheren
          </p>
        </div>

        {verified && (
          <div className="alert alert-success mb-6">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Email geverifieerd! Je kunt nu inloggen.</span>
          </div>
        )}

        {(error || authError) && (
          <div className="alert alert-error mb-6">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex flex-col gap-2">
              <span>{getErrorMessage(error || authError)}</span>
              {(error === "no_password_set" || authError === "no_password_set") && (
                <Link 
                  href="/auth/set-password" 
                  className="text-sm underline hover:text-red-200 transition-colors"
                >
                  → Wachtwoord instellen
                </Link>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="input"
          />

          <div>
            <Input
              id="password"
              name="password"
              type="password"
              label="Wachtwoord"
              placeholder="Je wachtwoord"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              className="input"
            />
            <div className="flex justify-end mt-1">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-blue-400 hover:text-cyan-400 transition-colors"
              >
                Wachtwoord vergeten?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full btn btn-primary btn-lg"
            loading={loading}
            disabled={loading}
          >
            Inloggen
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="divider w-full"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-[rgba(15,23,42,0.8)] text-slate-500">of</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full btn btn-secondary flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Doorgaan met Google
          </button>

          {!showMagicLink ? (
            <button
              type="button"
              onClick={() => setShowMagicLink(true)}
              className="w-full text-center text-sm text-slate-400 hover:text-cyan-400 py-2 transition-colors"
            >
              Liever een magic link? →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={!formData.email || loading}
              className="w-full btn btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>✉️</span>
              Magic Link Versturen
            </button>
          )}
        </div>

        <div className="text-center text-sm text-slate-400 mt-6">
          Nog geen account?{" "}
          <Link href="/auth/signup" className="text-blue-400 hover:text-cyan-400 font-medium transition-colors">
            Registreren
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
