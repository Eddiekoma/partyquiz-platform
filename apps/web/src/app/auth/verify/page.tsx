"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md" padding="lg">
        <div className="text-center space-y-4">
          <div className="text-6xl">✉️</div>
          <h1 className="text-3xl font-bold text-slate-100 font-display">
            Check je Email!
          </h1>
          <p className="text-slate-400">
            We hebben een magic link naar je email gestuurd. 
            Klik op de link om in te loggen.
          </p>
          <p className="text-sm text-slate-500">
            De link is 24 uur geldig.
          </p>
          
          <div className="pt-6">
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
