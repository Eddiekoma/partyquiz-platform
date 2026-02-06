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
          Welkom terug, {session?.user?.name || session?.user?.email}!
        </h1>
        <p className="mt-2 text-slate-400">
          Hier is een overzicht van je PartyQuiz platform.
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
            Organiseer je quizzen en werk samen met je team.
          </p>
          <Link
            href="/dashboard/workspaces"
            className="inline-flex items-center text-blue-400 font-semibold text-sm hover:text-blue-300 transition-colors group-hover:gap-2"
          >
            Bekijk Workspaces 
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Live Sessions Card */}
        <div className="glass-card p-6 hover:border-purple-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎮</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Live Sessies</h3>
          </div>
          <p className="text-slate-400 mb-4 text-sm">
            Start een live quiz sessie met real-time interactie.
          </p>
          <Link
            href="/dashboard/workspaces"
            className="inline-flex items-center text-purple-400 font-semibold text-sm hover:text-purple-300 transition-colors"
          >
            Kies een Workspace 
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Player Join Card */}
        <div className="glass-card p-6 hover:border-cyan-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Spelers Joinen</h3>
          </div>
          <p className="text-slate-400 mb-4 text-sm">
            Deel de join code zodat spelers kunnen meedoen.
          </p>
          <Link
            href="/join"
            className="inline-flex items-center text-cyan-400 font-semibold text-sm hover:text-cyan-300 transition-colors"
          >
            Naar Join Pagina 
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
              <h4 className="font-semibold text-white text-sm">Maak een Workspace</h4>
              <p className="text-xs text-slate-400 mt-1">
                Organiseer quizzen en nodig teamleden uit.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Voeg Vragen Toe</h4>
              <p className="text-xs text-slate-400 mt-1">
                15+ vraag types met multimedia support.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Bouw een Quiz</h4>
              <p className="text-xs text-slate-400 mt-1">
                Combineer vragen, media en minigames.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Start Live!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Deel de code en laat spelers joinen.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-slate-500 text-sm">
        <p>PartyQuiz Platform door Databridge360</p>
      </div>
    </div>
  );
}
