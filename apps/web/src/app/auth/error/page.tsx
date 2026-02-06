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
  // Custom error codes from credentials provider
  email_password_required: {
    title: "Gegevens Ontbreken",
    description: "Vul zowel je email als wachtwoord in om in te loggen.",
    icon: "📝",
  },
  user_not_found: {
    title: "Account Niet Gevonden",
    description: "Er is geen account met dit emailadres. Maak eerst een account aan of gebruik een ander emailadres.",
    icon: "🔍",
  },
  no_password_set: {
    title: "Geen Wachtwoord Ingesteld",
    description: "Dit account heeft nog geen wachtwoord. Stel een wachtwoord in via je accountinstellingen, of log in via Google.",
    icon: "�",
  },
  email_not_verified: {
    title: "Email Niet Geverifieerd",
    description: "Verifieer eerst je email voordat je kunt inloggen. Check je inbox voor de verificatielink.",
    icon: "✉️",
  },
  invalid_password: {
    title: "Onjuist Wachtwoord",
    description: "Het wachtwoord is onjuist. Probeer het opnieuw of gebruik 'Wachtwoord vergeten'.",
    icon: "🔑",
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
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]" />
      </div>
      
      <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
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
              className="block w-full btn btn-primary text-center"
            >
              Terug naar Inloggen
            </Link>
            
            {error === "Verification" && (
              <Link
                href="/auth/signin"
                className="block w-full btn btn-secondary text-center"
              >
                Nieuwe Link Aanvragen
              </Link>
            )}
            
            {(error === "EmailSignin" || error === "invalid_password") && (
              <Link
                href="/auth/forgot-password"
                className="block w-full btn btn-secondary text-center"
              >
                Wachtwoord Vergeten?
              </Link>
            )}

            {error === "user_not_found" && (
              <Link
                href="/auth/signup"
                className="block w-full btn btn-secondary text-center"
              >
                Account Aanmaken
              </Link>
            )}

            {error === "email_not_verified" && (
              <Link
                href="/auth/signin"
                className="block w-full btn btn-secondary text-center"
              >
                Verificatie Email Opnieuw Verzenden
              </Link>
            )}

            {error === "no_password_set" && (
              <Link
                href="/auth/set-password"
                className="block w-full btn btn-secondary text-center"
              >
                Wachtwoord Instellen
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
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
