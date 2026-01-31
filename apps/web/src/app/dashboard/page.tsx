import { auth } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import Link from "next/link";
import { SpotifyConnectCard } from "@/components/SpotifyConnectCard";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session?.user?.name || session?.user?.email}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's what's happening with your quizzes today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card hover>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Organize your quizzes and collaborate with your team.
            </p>
            <Link
              href="/dashboard/workspaces"
              className="text-primary-600 font-semibold hover:underline"
            >
              View Workspaces →
            </Link>
          </CardContent>
        </Card>

        <Card hover>
          <CardHeader>
            <CardTitle>Question Bank</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Create and manage your quiz questions with rich media.
            </p>
            <Link
              href="/dashboard/questions"
              className="text-primary-600 font-semibold hover:underline"
            >
              Browse Questions →
            </Link>
          </CardContent>
        </Card>

        <Card hover>
          <CardHeader>
            <CardTitle>Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Build and run interactive quizzes for your events.
            </p>
            <Link
              href="/dashboard/quizzes"
              className="text-primary-600 font-semibold hover:underline"
            >
              View Quizzes →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Spotify Integration */}
      <SpotifyConnectCard />

      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Create a Workspace</h4>
              <p className="text-sm text-gray-600">
                Organize your quizzes and invite team members to collaborate.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Add Questions</h4>
              <p className="text-sm text-gray-600">
                Build your question bank with 15+ question types, including multimedia.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Create a Quiz</h4>
              <p className="text-sm text-gray-600">
                Assemble questions into quizzes and customize the experience.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Start a Live Session</h4>
              <p className="text-sm text-gray-600">
                Share the join code, let players connect, and have fun!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
