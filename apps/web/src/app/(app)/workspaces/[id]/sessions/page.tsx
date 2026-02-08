import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import SessionCardActions from "./SessionCardActions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; quizId?: string }>;
}

async function getWorkspaceSessions(workspaceId: string, status?: string, quizId?: string) {
  const where: any = {
    workspaceId,
  };

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (quizId) {
    where.quizId = quizId;
  }

  const sessions = await prisma.liveSession.findMany({
    where,
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          rounds: {
            select: {
              _count: {
                select: {
                  items: true,
                },
              },
            },
          },
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
    LOBBY: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
    PAUSED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    ENDED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  const statusColor = statusColors[session.status as keyof typeof statusColors] || "bg-slate-500/20 text-slate-400";

  // Calculate total items across all rounds
  const totalItems = session.quiz.rounds?.reduce(
    (sum: number, round: any) => sum + (round._count?.items || 0),
    0
  ) || 0;

  // Calculate current progress (1-based for display)
  const currentItem = (session.currentItemIndex || 0) + 1;
  const hasProgress = session.status !== "LOBBY" && totalItems > 0;
  const progressPercent = hasProgress ? Math.round((currentItem / totalItems) * 100) : 0;

  // Session display name or quiz title
  const displayTitle = session.displayName || session.quiz.title;
  const showQuizTitle = session.displayName && session.displayName !== session.quiz.title;

  return (
    <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:border-slate-600 transition-all">
      <div className="flex items-start justify-between">
        <Link 
          href={`/workspaces/${session.workspaceId}/sessions/${session.id}`}
          className="flex-1 block"
        >
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{displayTitle}</h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusColor}`}
            >
              {session.status === "PAUSED" && "⏸️ "}
              {session.status}
            </span>
          </div>

          {showQuizTitle && (
            <p className="text-sm text-slate-400 mb-2">Quiz: {session.quiz.title}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
            <span>
              👥 {session._count.players} {session._count.players === 1 ? "player" : "players"}
            </span>
            <span>✓ {session._count.answers} answers</span>
            {hasProgress && (
              <span className="flex items-center gap-2">
                📊 Vraag {currentItem}/{totalItems} ({progressPercent}%)
              </span>
            )}
          </div>

          {/* Progress bar for active/paused sessions */}
          {hasProgress && (
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-3">
              <div 
                className={`h-full transition-all duration-300 ${
                  session.status === "PAUSED" ? "bg-yellow-500" : 
                  session.status === "ENDED" ? "bg-slate-500" : "bg-green-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Code: <strong className="text-slate-400">{session.code}</strong></span>
            <span>•</span>
            <span>Host: {session.host.name || session.host.email}</span>
            <span>•</span>
            <span>
              {session.pausedAt
                ? `Paused ${formatDistanceToNow(new Date(session.pausedAt), { addSuffix: true })}`
                : session.endedAt
                ? `Ended ${formatDistanceToNow(new Date(session.endedAt), { addSuffix: true })}`
                : session.startedAt
                ? `Started ${formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}`
                : `Created ${formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}`}
            </span>
          </div>
        </Link>

        {/* Action Buttons */}
        <div className="flex-shrink-0 ml-4">
          <SessionCardActions
            sessionId={session.id}
            sessionCode={session.code}
            workspaceId={session.workspaceId}
          />
        </div>
      </div>
    </div>
  );
}

function SessionsEmptyState() {
  return (
    <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="text-6xl mb-4">🎮</div>
      <h3 className="text-lg font-medium text-white mb-2">No sessions yet</h3>
      <p className="text-slate-400 mb-6">Create your first live session to get started.</p>
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
                : "bg-slate-800/50 text-slate-300 border border-slate-600 hover:bg-slate-700"
            }`}
          >
            {status.label}
          </Link>
        );
      })}
    </div>
  );
}

async function SessionsList({ workspaceId, status, quizId }: { workspaceId: string; status?: string; quizId?: string }) {
  const sessions = await getWorkspaceSessions(workspaceId, status, quizId);

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

  // Get quiz info if filtering by quizId
  let quiz = null;
  if (resolvedSearchParams.quizId) {
    quiz = await prisma.quiz.findFirst({
      where: {
        id: resolvedSearchParams.quizId,
        workspaceId: resolvedParams.id,
      },
      select: {
        id: true,
        title: true,
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {quiz ? (
          <>
            <Link
              href={`/dashboard/workspaces/${resolvedParams.id}/quizzes/${quiz.id}`}
              className="text-blue-400 hover:text-blue-300"
            >
              ← {quiz.title}
            </Link>
            <span className="text-slate-500">|</span>
            <Link 
              href={`/workspaces/${resolvedParams.id}/sessions`}
              className="text-slate-400 hover:text-slate-300"
            >
              All Sessions
            </Link>
          </>
        ) : (
          <Link
            href={`/dashboard/workspaces/${resolvedParams.id}`}
            className="text-blue-400 hover:text-blue-300"
          >
            ← {membership.workspace.name || "Workspace"}
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Live Sessions</h1>
          <p className="text-slate-400 mt-1">
            {quiz 
              ? `Sessions for "${quiz.title}"` 
              : "Create and manage live quiz sessions"}
          </p>
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

      {/* Sessions List */}
      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-800/50 border border-slate-700 rounded-lg animate-pulse" />
            ))}
          </div>
        }
      >
        <SessionsList 
          workspaceId={resolvedParams.id} 
          status={resolvedSearchParams.status} 
          quizId={resolvedSearchParams.quizId}
        />
      </Suspense>
    </div>
  );
}
