import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/lib/permissions";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import DeleteSessionButton from "./DeleteSessionButton";

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

async function getSession(workspaceId: string, sessionId: string) {
  const session = await prisma.liveSession.findFirst({
    where: {
      id: sessionId,
      workspaceId,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          logo: true,
          themeColor: true,
        },
      },
      quiz: {
        include: {
          rounds: {
            orderBy: { order: "asc" },
            include: {
              items: {
                orderBy: { order: "asc" },
                include: {
                  question: {
                    include: {
                      options: {
                        orderBy: { order: "asc" },
                      },
                      media: {
                        orderBy: { order: "asc" },
                      },
                    },
                  },
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
      players: {
        where: {
          leftAt: null,
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
      _count: {
        select: {
          answers: true,
        },
      },
    },
  });

  return session;
}

function SessionInfo({ session }: { session: any }) {
  const statusColors = {
    LOBBY: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
    PAUSED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    ENDED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  const statusColor = statusColors[session.status as keyof typeof statusColors] || "bg-slate-500/20 text-slate-400";
  const themeColor = session.workspace?.themeColor || "#3B82F6";

  // Calculate progress
  const totalItems = session.quiz.rounds.reduce((sum: number, round: any) => sum + round.items.length, 0);
  const currentItem = (session.currentItemIndex || 0) + 1;
  const hasProgress = session.status !== "LOBBY" && session.currentItemIndex !== null;
  const progressPercent = hasProgress ? Math.round((currentItem / totalItems) * 100) : 0;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      {/* Workspace Logo */}
      {session.workspace?.logo && (
        <div className="flex justify-center mb-4 pb-4 border-b border-slate-700">
          <img
            src={session.workspace.logo}
            alt="Workspace logo"
            className="h-12 object-contain"
          />
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{session.quiz.title}</h2>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border ${statusColor}`}
            >
              {session.status === "PAUSED" && "⏸️ "}
              {session.status}
            </span>
            <span className="text-sm text-slate-400">
              Host: {session.host.name || session.host.email}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
        <div>
          <p className="text-sm text-slate-400">Session Code</p>
          <p 
            className="text-2xl font-bold mt-1"
            style={{ color: themeColor }}
          >
            {session.code}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Active Players</p>
          <p className="text-2xl font-bold text-white mt-1">{session.players.length}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Total Answers</p>
          <p className="text-2xl font-bold text-white mt-1">{session._count.answers}</p>
        </div>
      </div>

      {/* Progress bar for paused/active sessions */}
      {hasProgress && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Progress</span>
            <span className="font-medium text-white">Question {currentItem} of {totalItems} ({progressPercent}%)</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                session.status === "PAUSED" ? "bg-yellow-500" : 
                session.status === "ENDED" ? "bg-slate-500" : "bg-green-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {session.pausedAt && (
        <p className="text-xs text-yellow-600 mt-4 flex items-center gap-2">
          <span>⏸️</span>
          Paused {formatDistanceToNow(new Date(session.pausedAt), { addSuffix: true })}
        </p>
      )}
      {session.startedAt && !session.pausedAt && (
        <p className="text-xs text-slate-400 mt-4">
          Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
        </p>
      )}
      {session.endedAt && (
        <p className="text-xs text-slate-400 mt-4">
          Ended {formatDistanceToNow(new Date(session.endedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

function PlayersList({ players }: { players: any[] }) {
  if (players.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">👥</div>
        <p className="text-slate-400">No players yet</p>
        <p className="text-sm text-slate-500 mt-1">Players will appear here when they join</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h3 className="font-semibold text-white mb-4">
        Players ({players.length})
      </h3>
      <div className="space-y-3">
        {players.map((player: any) => (
          <div
            key={player.id}
            className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
          >
            {player.avatar ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                {player.avatar}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                👤
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium text-white">{player.name}</p>
              <p className="text-xs text-slate-400">
                Joined {formatDistanceToNow(new Date(player.joinedAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizContent({ quiz }: { quiz: any }) {
  const totalItems = quiz.rounds.reduce((sum: number, round: any) => sum + round.items.length, 0);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h3 className="font-semibold text-white mb-4">
        Quiz Content ({quiz.rounds.length} rounds, {totalItems} items)
      </h3>
      <div className="space-y-4">
        {quiz.rounds.map((round: any, roundIndex: number) => (
          <div key={round.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/30">
            <h4 className="font-medium text-white mb-2">
              Round {roundIndex + 1}: {round.title}
            </h4>
            <div className="space-y-2">
              {round.items.map((item: any, itemIndex: number) => (
                <div key={item.id} className="flex items-center gap-2 text-sm text-slate-300 pl-4">
                  <span className="text-slate-500">{itemIndex + 1}.</span>
                  <span>{item.question?.title || "Question"}</span>
                  <span className="text-xs text-slate-500">
                    ({item.question?.type || "UNKNOWN"})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function SessionDetails({ workspaceId, sessionId, userId }: { workspaceId: string; sessionId: string; userId: string }) {
  const session = await getSession(workspaceId, sessionId);

  if (!session) {
    notFound();
  }

  const isHost = session.hostUserId === userId;
  const isEnded = session.status === "ENDED";

  return (
    <div className="space-y-6">
      <SessionInfo session={session} />

      {/* Session Actions */}
      {isHost && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Acties</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/host/${session.code}`}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              🎮 Open Host Screen
            </Link>
            <DeleteSessionButton 
              sessionId={session.id} 
              workspaceId={workspaceId}
              sessionName={session.displayName || session.quiz.title}
            />
          </div>
          <p className="text-slate-400 text-sm mt-3">
            {isEnded 
              ? "Open the host screen to view results and scores."
              : "Open the host screen to control the quiz, start questions and reveal answers."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlayersList players={session.players} />
        <QuizContent quiz={session.quiz} />
      </div>
    </div>
  );
}

export default async function SessionPage({ params }: PageProps) {
  // Next.js 16: params is a Promise
  const resolvedParams = await params;
  
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Check workspace membership
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: resolvedParams.id,
      userId: session.user.id,
    },
  });

  if (!membership) {
    redirect("/workspaces");
  }

  // Get session info for navigation
  const liveSession = await prisma.liveSession.findFirst({
    where: {
      id: resolvedParams.sessionId,
      workspaceId: resolvedParams.id,
    },
    select: {
      id: true,
      displayName: true,
      quiz: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={liveSession?.quiz 
            ? `/workspaces/${resolvedParams.id}/sessions?quizId=${liveSession.quiz.id}`
            : `/workspaces/${resolvedParams.id}/sessions`
          }
          className="text-blue-400 hover:text-blue-300"
        >
          ← Sessions
        </Link>
        {liveSession?.quiz && (
          <>
            <span className="text-slate-500">|</span>
            <Link
              href={`/dashboard/workspaces/${resolvedParams.id}/quizzes/${liveSession.quiz.id}`}
              className="text-slate-400 hover:text-slate-300"
            >
              {liveSession.quiz.title}
            </Link>
          </>
        )}
      </div>
      
      <h1 className="text-3xl font-bold text-white">
        {liveSession?.displayName || "Live Session"}
      </h1>

      {/* Session Details */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-48 bg-slate-800/50 border border-slate-700 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-slate-800/50 border border-slate-700 rounded-lg animate-pulse" />
              <div className="h-64 bg-slate-800/50 border border-slate-700 rounded-lg animate-pulse" />
            </div>
          </div>
        }
      >
        <SessionDetails workspaceId={resolvedParams.id} sessionId={resolvedParams.sessionId} userId={session.user.id} />
      </Suspense>
    </div>
  );
}
