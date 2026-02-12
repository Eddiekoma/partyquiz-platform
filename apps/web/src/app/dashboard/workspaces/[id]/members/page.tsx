"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export default function MembersPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch(`/api/workspaces/${workspaceId}/invites`),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data);
      } else if (invitesRes.status === 403) {
        // User doesn't have permission to view invites, that's okay
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Could not load data");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      OWNER: { bg: "from-yellow-500 to-orange-500", text: "text-white", label: "Owner" },
      ADMIN: { bg: "from-purple-500 to-pink-500", text: "text-white", label: "Admin" },
      EDITOR: { bg: "from-blue-500 to-cyan-500", text: "text-white", label: "Editor" },
      VIEWER: { bg: "from-slate-500 to-slate-600", text: "text-white", label: "Viewer" },
    };
    const style = styles[role] || styles.VIEWER;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${style.text} bg-gradient-to-r ${style.bg}`}>
        {style.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link 
            href={`/dashboard/workspaces/${workspaceId}`}
            className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-2"
          >
            ← Back to workspace
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Team Members
          </h1>
          <p className="mt-1 text-slate-400">
            Manage who has access to this workspace
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 flex items-center gap-2"
        >
          <span>+</span> Invite
        </button>
      </div>

      {/* Members List */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>👥</span> Members ({members.length})
        </h2>
        
        <div className="space-y-3">
          {members.map((member) => (
            <div 
              key={member.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {member.user.name?.[0]?.toUpperCase() || member.user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="font-medium text-white">
                    {member.user.name || member.user.email?.split("@")[0] || "Unknown"}
                  </div>
                  <div className="text-sm text-slate-400">{member.user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">
                  Member since {new Date(member.joinedAt).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {getRoleBadge(member.role)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>✉️</span> Pending Invitations ({invites.length})
          </h2>
          
          <div className="space-y-3">
            {invites.map((invite) => (
              <div 
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-white">{invite.email}</div>
                    <div className="text-sm text-slate-400">
                      Invited by {invite.invitedBy.name || invite.invitedBy.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">
                    Expires {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {getRoleBadge(invite.role)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Legend */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Role Explanation</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge("OWNER")}
            </div>
            <p className="text-xs text-slate-400">
              Full control, can delete workspace and transfer ownership
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge("ADMIN")}
            </div>
            <p className="text-xs text-slate-400">
              Can manage members, change settings and start live sessions
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge("EDITOR")}
            </div>
            <p className="text-xs text-slate-400">
              Can create and edit questions, quizzes and media
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              {getRoleBadge("VIEWER")}
            </div>
            <p className="text-xs text-slate-400">
              Can only view content, cannot make changes
            </p>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          workspaceId={workspaceId}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function InviteModal({
  workspaceId,
  onClose,
  onInvited,
}: {
  workspaceId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not send invitation");
        return;
      }

      setSuccess(true);
      setInviteLink(`${window.location.origin}/invites/${data.token}`);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-elevated max-w-md w-full p-6 animate-fade-in">
        {!success ? (
          <>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white">Invite Member</h3>
              <p className="text-sm text-slate-400 mt-1">
                Send an invitation to a team member
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                  placeholder="colleague@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full"
                >
                  <option value="ADMIN">Admin - Full access</option>
                  <option value="EDITOR">Editor - Can create content</option>
                  <option value="VIEWER">Viewer - View only</option>
                </select>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Invite
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Invitation Sent!</h3>
              <p className="text-slate-400 mb-6">
                We have sent an invitation to <span className="text-white">{email}</span>
              </p>
            </div>

            {inviteLink && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Or share this link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="w-full text-sm"
                  />
                  <button
                    onClick={copyLink}
                    className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
                  >
                    📋
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              >
                Close
              </button>
              <button
                onClick={onInvited}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
