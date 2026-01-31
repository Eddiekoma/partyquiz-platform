"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
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
        <div className="text-gray-600">Loading workspace...</div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  const canInvite = ["OWNER", "ADMIN"].includes(workspace.role);
  const canDelete = workspace.role === "OWNER";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">{workspace.name}</h1>
            <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
              {workspace.role}
            </span>
          </div>
          {workspace.description && (
            <p className="mt-2 text-gray-600">{workspace.description}</p>
          )}
        </div>
        <div className="flex space-x-3">
          <Link href={`/dashboard/workspaces/${workspace.id}/questions`}>
            <Button>View Questions</Button>
          </Link>
          {canDelete && (
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary-600">
              {workspace._count.questions}
            </div>
            <p className="text-gray-600 mt-2">questions in this workspace</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary-600">
              {workspace._count.quizzes}
            </div>
            <p className="text-gray-600 mt-2">quizzes ready to play</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              {workspace.members.length}
            </div>
            <p className="text-gray-600 mt-2">team members</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Team Members</CardTitle>
            {canInvite && (
              <Button size="sm" onClick={() => setShowInviteModal(true)}>
                + Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workspace.members.map((member) => (
              <div
                key={member.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-semibold text-gray-900">
                    {member.user.name || member.user.email}
                  </div>
                  {member.user.name && (
                    <div className="text-sm text-gray-600">{member.user.email}</div>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                    {member.role}
                  </span>
                  {member.role !== "OWNER" && canInvite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (confirm("Remove this member from the workspace?")) {
                          const res = await fetch(
                            `/api/workspaces/${workspace.id}/members/${member.userId}`,
                            { method: "DELETE" }
                          );
                          if (res.ok) {
                            fetchWorkspace();
                          }
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showInviteModal && (
        <InviteMemberModal
          workspaceId={workspace.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            // Optionally refresh workspace
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full" padding="lg">
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="colleague@example.com"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="VIEWER">Viewer - Can view questions and quizzes</option>
              <option value="EDITOR">Editor - Can create and edit content</option>
              <option value="ADMIN">Admin - Can manage members and settings</option>
            </select>
          </div>

          <div className="flex space-x-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!email || loading} className="flex-1">
              Send Invite
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
