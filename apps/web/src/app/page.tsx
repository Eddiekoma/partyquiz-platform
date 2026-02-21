export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center px-4 py-8 sm:p-6">
      <div className="max-w-4xl w-full text-center space-y-6 sm:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold text-white drop-shadow-lg party-pulse">
            🎉 PartyQuiz
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-white/90 px-2">
            Create amazing quizzes with music, video, and epic minigames
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 max-w-2xl mx-auto">
          <a
            href="/auth/signin"
            className="bg-white text-primary-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:scale-105 transform transition shadow-xl"
          >
            Sign In
          </a>
          <a
            href="/auth/signup"
            className="bg-primary-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:scale-105 transform transition shadow-xl border-2 border-white"
          >
            Get Started Free
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-16 text-white">
          <div className="bg-white/10 backdrop-blur-sm p-4 sm:p-6 rounded-xl">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🎵</div>
            <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">Music Integration</h3>
            <p className="text-sm text-white/80">
              Connect Spotify and create music quiz rounds
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 sm:p-6 rounded-xl">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🎮</div>
            <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">Epic Minigames</h3>
            <p className="text-sm text-white/80">
              Swan Race and more - keep players engaged!
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 sm:p-6 rounded-xl">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">👥</div>
            <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">Collaborate</h3>
            <p className="text-sm text-white/80">
              Work together on question banks and quizzes
            </p>
          </div>
        </div>

        <div className="pt-6 sm:pt-8 text-white/60 text-sm">
          <p>Platform by Databridge360 • Production Ready</p>
        </div>
      </div>
    </div>
  );
}
