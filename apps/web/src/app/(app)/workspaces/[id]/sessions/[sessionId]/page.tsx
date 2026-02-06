import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/lib/permissions";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import SessionControl from "./SessionControl";
import HostControlPanel from "./HostControlPanel";

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
    LOBBY: "bg-blue-100 text-blue-800 border-blue-200",
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    PAUSED: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ENDED: "bg-slate-700 text-gray-800 border-slate-700",
  };

  const statusColor = statusColors[session.status as keyof typeof statusColors] || "bg-slate-700 text-gray-800";
  const themeColor = session.workspace?.themeColor || "#3B82F6";

  return (
    <div className="bg-white border border-slate-700 rounded-lg p-6">
      {/* Workspace Logo */}
      {session.workspace?.logo && (
        <div className="flex justify-center mb-4 pb-4 border-b border-gray-100">
          <img
            src={session.workspace.logo}
            alt="Workspace logo"
            className="h-12 object-contain"
          />
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{session.quiz.title}</h2>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border ${statusColor}`}
              style={session.status === "ACTIVE" ? { 
                backgroundColor: `${themeColor}20`, 
                borderColor: themeColor,
                color: themeColor 
              } : {}}
            >
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
          <p className="text-2xl font-bold text-gray-900 mt-1">{session.players.length}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Total Answers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{session._count.answers}</p>
        </div>
      </div>

      {session.startedAt && (
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
      <div className="bg-white border border-slate-700 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">👥</div>
        <p className="text-slate-400">No players yet</p>
        <p className="text-sm text-slate-400 mt-1">Players will appear here when they join</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-700 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">
        Players ({players.length})
      </h3>
      <div className="space-y-3">
        {players.map((player: any) => (
          <div
            key={player.id}
            className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
          >
            {player.avatar ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                {player.avatar}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                👤
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{player.name}</p>
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
    <div className="bg-white border border-slate-700 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">
        Quiz Content ({quiz.rounds.length} rounds, {totalItems} items)
      </h3>
      <div className="space-y-4">
        {quiz.rounds.map((round: any, roundIndex: number) => (
          <div key={round.id} className="border border-slate-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              Round {roundIndex + 1}: {round.title}
            </h4>
            <div className="space-y-2">
              {round.items.map((item: any, itemIndex: number) => (
                <div key={item.id} className="flex items-center gap-2 text-sm text-slate-400 pl-4">
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

  return (
    <div className="space-y-6">
      <SessionInfo session={session} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PlayersList players={session.players} />
          <QuizContent quiz={session.quiz} />
        </div>
        
        {isHost && session.status !== "ENDED" && (
          <div className="lg:col-span-1">
            <HostControlPanel session={session} quiz={session.quiz} />
          </div>
        )}

        {isHost && session.status === "ENDED" && (
          <div className="lg:col-span-1">
            <SessionControl session={session} />
          </div>
        )}
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

  return (
    <div className="min-h-screen bg-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/workspaces/${resolvedParams.id}/sessions`}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
          >
            ← Back to Sessions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Live Session</h1>
        </div>

        {/* Session Details */}
        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="h-48 bg-white border border-slate-700 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 bg-white border border-slate-700 rounded-lg animate-pulse" />
                <div className="h-64 bg-white border border-slate-700 rounded-lg animate-pulse" />
              </div>
            </div>
          }
        >
          <SessionDetails workspaceId={resolvedParams.id} sessionId={resolvedParams.sessionId} userId={session.user.id} />
        </Suspense>
      </div>
    </div>
  );
}
