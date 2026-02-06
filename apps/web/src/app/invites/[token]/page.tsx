"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";

interface InviteDetails {
  email: string;
  role: string;
  expiresAt: string;
  workspace: {
    id: string;
    name: string;
    description: string | null;
  };
  invitedBy: {
    name: string | null;
    email: string | null;
  };
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = params.token as string;

  useEffect(() => {
    if (token) {
      fetchInvite();
    }
  }, [token]);

  const fetchInvite = async () => {
    try {
      const res = await fetch(`/api/invites/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kon uitnodiging niet laden");
        return;
      }

      setInvite(data);
    } catch (err) {
      setError("Er is iets misgegaan bij het laden van de uitnodiging");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kon uitnodiging niet accepteren");
        setAccepting(false);
        return;
      }

      setSuccess(true);
      // Redirect to workspace after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/workspaces/${data.workspaceId}`);
      }, 2000);
    } catch (err) {
      setError("Er is iets misgegaan");
      setAccepting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "from-purple-500 to-pink-500";
      case "EDITOR":
        return "from-blue-500 to-cyan-500";
      case "VIEWER":
        return "from-slate-500 to-slate-600";
      default:
        return "from-slate-500 to-slate-600";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Beheerder";
      case "EDITOR":
        return "Bewerker";
      case "VIEWER":
        return "Kijker";
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Uitnodiging laden...
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-white mb-2">Uitnodiging Niet Gevonden</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
          >
            Naar Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welkom bij {invite?.workspace.name}!</h1>
          <p className="text-slate-400 mb-4">Je bent nu lid van deze workspace.</p>
          <p className="text-sm text-slate-500">Je wordt doorgestuurd...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show sign in prompt
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Je bent uitgenodigd!</h1>
          <p className="text-slate-400 mb-6">
            Je bent uitgenodigd voor <span className="text-white font-semibold">{invite?.workspace.name}</span>. 
            Log in om de uitnodiging te accepteren.
          </p>
          
          <div className="glass-elevated p-4 rounded-xl mb-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-lg">🏢</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">{invite?.workspace.name}</h3>
                <p className="text-xs text-slate-400">{invite?.workspace.description || "Geen beschrijving"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Je rol:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${getRoleBadgeColor(invite?.role || "")}`}>
                {getRoleLabel(invite?.role || "")}
              </span>
            </div>
          </div>

          <button
            onClick={() => signIn(undefined, { callbackUrl: `/invites/${token}` })}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
          >
            Inloggen om te accepteren
          </button>
        </div>
      </div>
    );
  }

  // Loading session
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Laden...
        </div>
      </div>
    );
  }

  // Logged in - show accept UI
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full animate-fade-in">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Workspace Uitnodiging</h1>
          <p className="text-slate-400">
            Je bent uitgenodigd door <span className="text-white">{invite?.invitedBy.name || invite?.invitedBy.email}</span>
          </p>
        </div>

        {/* Workspace Preview */}
        <div className="glass-elevated p-5 rounded-xl mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl">
              🏢
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{invite?.workspace.name}</h2>
              <p className="text-sm text-slate-400">{invite?.workspace.description || "Geen beschrijving"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <span className="text-xs text-slate-500 block mb-1">Je email</span>
              <span className="text-sm text-white">{invite?.email}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Je rol</span>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${getRoleBadgeColor(invite?.role || "")}`}>
                {getRoleLabel(invite?.role || "")}
              </span>
            </div>
          </div>
        </div>

        {/* Email mismatch warning */}
        {session?.user?.email?.toLowerCase() !== invite?.email.toLowerCase() && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-400">
              ⚠️ Je bent ingelogd als <span className="font-semibold">{session?.user?.email}</span>, 
              maar deze uitnodiging is voor <span className="font-semibold">{invite?.email}</span>.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 px-4 py-3 text-center text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
          >
            Annuleren
          </Link>
          <button
            onClick={handleAccept}
            disabled={accepting || session?.user?.email?.toLowerCase() !== invite?.email.toLowerCase()}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {accepting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {accepting ? "Accepteren..." : "Accepteren"}
          </button>
        </div>

        {/* Expiry notice */}
        <p className="text-center text-xs text-slate-500 mt-4">
          Deze uitnodiging verloopt op {new Date(invite?.expiresAt || "").toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
