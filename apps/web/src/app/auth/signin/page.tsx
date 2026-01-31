"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        alert("Er ging iets mis. Probeer het opnieuw.");
      } else {
        setSent(true);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      alert("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500 p-4">
        <Card className="max-w-md w-full" padding="lg">
          <div className="text-center space-y-4">
            <div className="text-6xl">✉️</div>
            <h1 className="text-3xl font-bold text-gray-900">Check Your Email!</h1>
            <p className="text-gray-600">
              We've sent a magic link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Click the link in the email to sign in. The link expires in 24 hours.
            </p>
            <Button
              variant="ghost"
              onClick={() => setSent(false)}
              className="mt-4"
            >
              Try a different email
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500 p-4">
      <Card className="max-w-md w-full" padding="lg">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
          <p className="text-gray-600">
            Sign in to access your quizzes and workspaces
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Button
            type="submit"
            className="w-full"
            loading={loading}
            disabled={!email || loading}
          >
            Send Magic Link
          </Button>
        </form>

        <div className="text-center text-sm text-gray-600 mt-6">
          <p>We'll send you a magic link to sign in.</p>
          <p className="mt-2">No password needed! 🎉</p>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <a href="/" className="text-primary-600 font-semibold hover:underline">
              Get started free
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
