export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-bold text-white drop-shadow-lg party-pulse">
            🎉 PartyQuiz
          </h1>
          <p className="text-xl md:text-2xl text-white/90">
            Create amazing quizzes with music, video, and epic minigames
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <a
            href="/auth/signin"
            className="bg-white text-primary-700 px-8 py-4 rounded-xl font-semibold text-lg hover:scale-105 transform transition shadow-xl"
          >
            Sign In
          </a>
          <a
            href="/auth/signup"
            className="bg-primary-700 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:scale-105 transform transition shadow-xl border-2 border-white"
          >
            Get Started Free
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 text-white">
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <div className="text-4xl mb-4">🎵</div>
            <h3 className="font-semibold text-lg mb-2">Music Integration</h3>
            <p className="text-sm text-white/80">
              Connect Spotify and create music quiz rounds
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="font-semibold text-lg mb-2">Epic Minigames</h3>
            <p className="text-sm text-white/80">
              Swan Race and more - keep players engaged!
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="font-semibold text-lg mb-2">Collaborate</h3>
            <p className="text-sm text-white/80">
              Work together on question banks and quizzes
            </p>
          </div>
        </div>

        <div className="pt-8 text-white/60 text-sm">
          <p>Platform by Databridge360 • Production Ready</p>
        </div>
      </div>
    </div>
  );
}
