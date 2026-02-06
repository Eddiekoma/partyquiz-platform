"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px]" />
      </div>
      
      <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
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
