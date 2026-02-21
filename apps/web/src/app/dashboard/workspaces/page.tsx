"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  role: string;
  _count: {
    members: number;
    questions: number;
    quizzes: number;
  };
  createdAt: string;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Loading workspaces...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Workspaces
          </h1>
          <p className="mt-1 sm:mt-2 text-slate-400 text-sm sm:text-base">
            Organize your quizzes and collaborate with your team.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold text-sm sm:text-base hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 flex items-center gap-2 self-start sm:self-auto flex-shrink-0"
        >
          <span>+</span> New Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No workspaces yet
          </h3>
          <p className="text-slate-400 mb-6">
            Create your first workspace to get started with PartyQuiz.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
          >
            Create Your First Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={`/dashboard/workspaces/${workspace.id}`}>
              <div className="glass-card p-6 h-full cursor-pointer hover:border-blue-500/30 transition-all duration-300 group">
                <div className="mb-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {workspace.name}
                    </h3>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                      {workspace.role}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                    {workspace.description || "No description"}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm pt-4 border-t border-white/10">
                    <div>
                      <div className="font-semibold text-white">
                        {workspace._count.members}
                      </div>
                      <div className="text-slate-500 text-xs">Members</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {workspace._count.questions}
                      </div>
                      <div className="text-slate-500 text-xs">Questions</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {workspace._count.quizzes}
                      </div>
                      <div className="text-slate-500 text-xs">Quizzes</div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchWorkspaces();
          }}
        />
      )}
    </div>
  );
}

function CreateWorkspaceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (res.ok) {
        onCreated();
      } else {
        alert("Could not create workspace");
      }
    } catch (error) {
      console.error("Failed to create workspace:", error);
      alert("Could not create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-elevated max-w-md w-full p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white">New Workspace</h3>
          <p className="text-sm text-slate-400 mt-1">Create a workspace to organize your quizzes</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full"
              placeholder="My Awesome Workspace"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full"
              placeholder="What is this workspace for?"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
