import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}

async function getWorkspaceSessions(workspaceId: string, status?: string) {
  const where: any = {
    workspaceId,
  };

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  const sessions = await prisma.liveSession.findMany({
    where,
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
        },
      },
      host: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          players: {
            where: {
              leftAt: null, // Only active players
            },
          },
          answers: true,
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
  });

  return sessions;
}

function SessionCard({ session }: { session: any }) {
  const statusColors = {
    LOBBY: "bg-blue-100 text-blue-800 border-blue-200",
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    PAUSED: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ENDED: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const statusColor = statusColors[session.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";

  return (
    <Link
      href={`/workspaces/${session.workspaceId}/sessions/${session.id}`}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{session.quiz.title}</h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusColor}`}
            >
              {session.status}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            <span>
              👥 {session._count.players} {session._count.players === 1 ? "player" : "players"}
            </span>
            <span>✓ {session._count.answers} answers</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Code: <strong>{session.code}</strong></span>
            <span>•</span>
            <span>Host: {session.host.name || session.host.email}</span>
            <span>•</span>
            <span>
              {session.endedAt
                ? `Ended ${formatDistanceToNow(new Date(session.endedAt), { addSuffix: true })}`
                : session.startedAt
                ? `Started ${formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}`
                : `Created ${formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SessionsEmptyState() {
  return (
    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
      <div className="text-6xl mb-4">🎮</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
      <p className="text-gray-600 mb-6">Create your first live session to get started.</p>
    </div>
  );
}

function StatusFilter({ currentStatus }: { currentStatus?: string }) {
  const statuses = [
    { value: "all", label: "All Sessions" },
    { value: "lobby", label: "Lobby" },
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "ended", label: "Ended" },
  ];

  return (
    <div className="flex gap-2">
      {statuses.map((status) => {
        const isActive = (currentStatus || "all") === status.value;
        return (
          <Link
            key={status.value}
            href={`?status=${status.value}`}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {status.label}
          </Link>
        );
      })}
    </div>
  );
}

async function SessionsList({ workspaceId, status }: { workspaceId: string; status?: string }) {
  const sessions = await getWorkspaceSessions(workspaceId, status);

  if (sessions.length === 0) {
    return <SessionsEmptyState />;
  }

  return (
    <div className="space-y-4">
      {sessions.map((session: any) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}

export default async function SessionsPage({ params, searchParams }: PageProps) {
  // Next.js 16: params and searchParams are Promises
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Check workspace membership and permissions
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: resolvedParams.id,
      userId: session.user.id,
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    redirect("/workspaces");
  }

  // Check if user can create sessions
  const canCreate = hasPermission(membership.role as WorkspaceRole, Permission.SESSION_CREATE);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Live Sessions</h1>
              <p className="text-gray-600 mt-1">Create and manage live quiz sessions</p>
            </div>
            {canCreate && (
              <Link
                href={`/workspaces/${resolvedParams.id}/sessions/new`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span className="mr-2">▶️</span>
                New Session
              </Link>
            )}
          </div>

          <StatusFilter currentStatus={resolvedSearchParams.status} />
        </div>

        {/* Sessions List */}
        <Suspense
          fallback={
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-white border border-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          }
        >
          <SessionsList workspaceId={resolvedParams.id} status={resolvedSearchParams.status} />
        </Suspense>
      </div>
    </div>
  );
}
