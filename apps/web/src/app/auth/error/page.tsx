"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui";

const errorMessages: Record<string, { title: string; description: string; icon: string }> = {
  Configuration: {
    title: "Server Configuratie Fout",
    description: "Er is een probleem met de server configuratie. Neem contact op met de beheerder.",
    icon: "⚙️",
  },
  AccessDenied: {
    title: "Toegang Geweigerd",
    description: "Je hebt geen toegang tot deze resource.",
    icon: "🚫",
  },
  Verification: {
    title: "Verificatie Mislukt",
    description: "De verificatie link is verlopen of al gebruikt. Vraag een nieuwe aan.",
    icon: "⏰",
  },
  OAuthSignin: {
    title: "OAuth Fout",
    description: "Er ging iets mis bij het inloggen met een externe provider.",
    icon: "🔐",
  },
  OAuthCallback: {
    title: "OAuth Callback Fout",
    description: "Er ging iets mis bij het verwerken van de login respons.",
    icon: "🔄",
  },
  OAuthCreateAccount: {
    title: "Account Aanmaken Mislukt",
    description: "Er ging iets mis bij het aanmaken van je account.",
    icon: "👤",
  },
  EmailCreateAccount: {
    title: "Account Aanmaken Mislukt",
    description: "Er ging iets mis bij het aanmaken van je account via email.",
    icon: "📧",
  },
  Callback: {
    title: "Callback Fout",
    description: "Er ging iets mis bij het verwerken van je verzoek.",
    icon: "❌",
  },
  OAuthAccountNotLinked: {
    title: "Account Niet Gekoppeld",
    description: "Dit emailadres is al geregistreerd met een andere inlogmethode. Probeer in te loggen met de originele methode.",
    icon: "🔗",
  },
  EmailSignin: {
    title: "Email Verzenden Mislukt",
    description: "Er ging iets mis bij het verzenden van de verificatie email. Probeer het opnieuw.",
    icon: "📬",
  },
  CredentialsSignin: {
    title: "Inloggen Mislukt",
    description: "De inloggegevens zijn onjuist. Controleer je email en wachtwoord.",
    icon: "🔑",
  },
  SessionRequired: {
    title: "Sessie Vereist",
    description: "Je moet ingelogd zijn om deze pagina te bekijken.",
    icon: "🔒",
  },
  Default: {
    title: "Er Ging Iets Mis",
    description: "Er is een onverwachte fout opgetreden. Probeer het opnieuw.",
    icon: "😕",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  
  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
        <div className="text-center space-y-4">
          <div className="text-6xl">{errorInfo.icon}</div>
          <h1 className="text-3xl font-bold text-slate-100 font-display">
            {errorInfo.title}
          </h1>
          <p className="text-slate-400">
            {errorInfo.description}
          </p>
          
          {error && error !== "Default" && (
            <p className="text-xs text-slate-600 font-mono">
              Foutcode: {error}
            </p>
          )}

          <div className="pt-6 space-y-3">
            <Link
              href="/auth/signin"
              className="block w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 px-6 rounded-full text-center transition"
            >
              Terug naar Inloggen
            </Link>
            
            {error === "Verification" && (
              <Link
                href="/auth/signin"
                className="block w-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 font-medium py-3 px-6 rounded-full border border-slate-600/50 text-center transition"
              >
                Nieuwe Link Aanvragen
              </Link>
            )}
            
            {error === "EmailSignin" && (
              <Link
                href="/auth/forgot-password"
                className="block w-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 font-medium py-3 px-6 rounded-full border border-slate-600/50 text-center transition"
              >
                Wachtwoord Vergeten?
              </Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Laden...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
