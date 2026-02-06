"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface WorkspaceMember {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  role: string;
  members: WorkspaceMember[];
  _count: {
    questions: number;
    quizzes: number;
  };
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    fetchWorkspace();
  }, [params.id]);

  const fetchWorkspace = async () => {
    try {
      const res = await fetch(`/api/workspaces/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data);
      } else if (res.status === 404) {
        router.push("/dashboard/workspaces");
      }
    } catch (error) {
      console.error("Failed to fetch workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this workspace? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${params.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard/workspaces");
      } else {
        alert("Failed to delete workspace");
      }
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      alert("Failed to delete workspace");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Workspace laden...
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  const canInvite = ["OWNER", "ADMIN"].includes(workspace.role);
  const canDelete = workspace.role === "OWNER";

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      OWNER: "from-yellow-500 to-orange-500",
      ADMIN: "from-purple-500 to-pink-500",
      EDITOR: "from-blue-500 to-cyan-500",
      VIEWER: "from-slate-500 to-slate-600",
    };
    return styles[role] || styles.VIEWER;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link 
            href="/dashboard/workspaces"
            className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-2"
          >
            ← Alle workspaces
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {workspace.name}
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full text-white bg-gradient-to-r ${getRoleBadge(workspace.role)}`}>
              {workspace.role}
            </span>
          </div>
          {workspace.description && (
            <p className="mt-2 text-slate-400">{workspace.description}</p>
          )}
        </div>
        <div className="flex gap-3">
          {canDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200"
            >
              Verwijderen
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Link 
          href={`/dashboard/workspaces/${workspace.id}/questions`}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>📝</span> Vragen
        </Link>
        <Link 
          href={`/dashboard/workspaces/${workspace.id}/quizzes`}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>🎯</span> Quizzen
        </Link>
        <Link 
          href={`/dashboard/workspaces/${workspace.id}/members`}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>👥</span> Team
        </Link>
        <Link 
          href={`/dashboard/workspaces/${workspace.id}/media`}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>🎵</span> Media
        </Link>
        <Link 
          href={`/dashboard/workspaces/${workspace.id}/branding`}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>🎨</span> Branding
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 group hover:border-blue-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Vragen</h3>
          </div>
          <div className="text-4xl font-bold text-white">{workspace._count.questions}</div>
          <p className="text-slate-500 text-sm mt-1">in de vragenbank</p>
        </div>

        <div className="glass-card p-6 group hover:border-purple-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Quizzen</h3>
          </div>
          <div className="text-4xl font-bold text-white">{workspace._count.quizzes}</div>
          <p className="text-slate-500 text-sm mt-1">klaar om te spelen</p>
        </div>

        <div className="glass-card p-6 group hover:border-green-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <span className="text-lg">👥</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Team</h3>
          </div>
          <div className="text-4xl font-bold text-white">{workspace.members.length}</div>
          <p className="text-slate-500 text-sm mt-1">teamleden</p>
        </div>
      </div>

      {/* Team Members Preview */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>👥</span> Team Leden
          </h3>
          <div className="flex gap-2">
            {canInvite && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
              >
                + Uitnodigen
              </button>
            )}
            <Link 
              href={`/dashboard/workspaces/${workspace.id}/members`}
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
            >
              Alle bekijken →
            </Link>
          </div>
        </div>
        
        <div className="space-y-2">
          {workspace.members.slice(0, 5).map((member) => (
            <div
              key={member.id}
              className="flex justify-between items-center p-3 rounded-xl bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                  {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">
                    {member.user.name || member.user.email.split("@")[0]}
                  </div>
                  {member.user.name && (
                    <div className="text-xs text-slate-500">{member.user.email}</div>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full text-white bg-gradient-to-r ${getRoleBadge(member.role)}`}>
                {member.role}
              </span>
            </div>
          ))}
          {workspace.members.length > 5 && (
            <p className="text-center text-sm text-slate-500 pt-2">
              En {workspace.members.length - 5} meer...
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>⚡</span> Snelle Acties
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Link 
            href={`/dashboard/workspaces/${workspace.id}/questions/new`}
            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="text-2xl mb-2">➕</div>
            <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors">Nieuwe Vraag</h4>
            <p className="text-xs text-slate-500">Voeg een vraag toe aan de bank</p>
          </Link>
          <Link 
            href={`/dashboard/workspaces/${workspace.id}/quizzes/new`}
            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="text-2xl mb-2">🎯</div>
            <h4 className="font-medium text-white group-hover:text-purple-400 transition-colors">Nieuwe Quiz</h4>
            <p className="text-xs text-slate-500">Maak een quiz van je vragen</p>
          </Link>
          <Link 
            href={`/(app)/workspaces/${workspace.id}/sessions`}
            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="text-2xl mb-2">🚀</div>
            <h4 className="font-medium text-white group-hover:text-green-400 transition-colors">Live Sessie</h4>
            <p className="text-xs text-slate-500">Start een live quiz sessie</p>
          </Link>
        </div>
      </div>

      {showInviteModal && (
        <InviteMemberModal
          workspaceId={workspace.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            fetchWorkspace();
          }}
        />
      )}
    </div>
  );
}

function InviteMemberModal({
  workspaceId,
  onClose,
  onInvited,
}: {
  workspaceId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("EDITOR");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (res.ok) {
        alert("Invite sent! (Email functionality not yet implemented)");
        onInvited();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send invite");
      }
    } catch (error) {
      console.error("Failed to send invite:", error);
      alert("Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <span>✉️</span> Team Lid Uitnodigen
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email Adres *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500"
              placeholder="collega@voorbeeld.com"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-2">
              Rol *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "EDITOR" | "VIEWER")}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
            >
              <option value="VIEWER" className="bg-slate-900">Viewer - Kan vragen en quizzen bekijken</option>
              <option value="EDITOR" className="bg-slate-900">Editor - Kan content maken en bewerken</option>
              <option value="ADMIN" className="bg-slate-900">Admin - Kan leden en settings beheren</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
            >
              Annuleren
            </button>
            <button 
              type="submit" 
              disabled={!email || loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Versturen...
                </>
              ) : (
                "Uitnodiging Versturen"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
