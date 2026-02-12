import { auth } from "@/auth";
import Link from "next/link";
import { SpotifyConnectCard } from "@/components/SpotifyConnectCard";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Welcome back, {session?.user?.name || session?.user?.email}!
        </h1>
        <p className="mt-2 text-slate-400">
          Here is an overview of your PartyQuiz platform.
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Workspaces Card */}
        <div className="glass-card p-6 hover:border-blue-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-xl">🏢</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Workspaces</h3>
          </div>
          <p className="text-slate-400 mb-4 text-sm">
            Organize your quizzes and collaborate with your team.
          </p>
          <Link
            href="/dashboard/workspaces"
            className="inline-flex items-center text-blue-400 font-semibold text-sm hover:text-blue-300 transition-colors group-hover:gap-2"
          >
            View Workspaces 
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Live Sessions Card */}
        <div className="glass-card p-6 hover:border-purple-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎮</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Live Sessions</h3>
          </div>
          <p className="text-slate-400 mb-4 text-sm">
            Start a live quiz session with real-time interaction.
          </p>
          <Link
            href="/dashboard/workspaces"
            className="inline-flex items-center text-purple-400 font-semibold text-sm hover:text-purple-300 transition-colors"
          >
            Choose a Workspace 
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Player Join Card */}
        <div className="glass-card p-6 hover:border-cyan-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Player Join</h3>
          </div>
          <p className="text-slate-400 mb-4 text-sm">
            Share the join code so players can participate.
          </p>
          <Link
            href="/join"
            className="inline-flex items-center text-cyan-400 font-semibold text-sm hover:text-cyan-300 transition-colors"
          >
            Go to Join Page 
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>

      {/* Spotify Integration */}
      <SpotifyConnectCard />

      {/* Quick Start Guide */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <span className="text-2xl">🚀</span> Quick Start Guide
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Create a Workspace</h4>
              <p className="text-xs text-slate-400 mt-1">
                Organize quizzes and invite team members.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Add Questions</h4>
              <p className="text-xs text-slate-400 mt-1">
                15+ question types with multimedia support.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Build a Quiz</h4>
              <p className="text-xs text-slate-400 mt-1">
                Combine questions, media, and minigames.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Go Live!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Share the code and let players join.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-slate-500 text-sm">
        <p>PartyQuiz Platform by Databridge360</p>
      </div>
    </div>
  );
}
