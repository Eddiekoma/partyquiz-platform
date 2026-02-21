"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui";

const errorMessages: Record<string, { title: string; description: string; icon: string }> = {
  Configuration: {
    title: "Server Configuration Error",
    description: "There is a problem with the server configuration. Please contact the administrator.",
    icon: "⚙️",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "You do not have access to this resource.",
    icon: "🚫",
  },
  Verification: {
    title: "Verification Failed",
    description: "The verification link has expired or has already been used. Please request a new one.",
    icon: "⏰",
  },
  OAuthSignin: {
    title: "OAuth Error",
    description: "Something went wrong while signing in with an external provider.",
    icon: "🔐",
  },
  OAuthCallback: {
    title: "OAuth Callback Error",
    description: "Something went wrong while processing the login response.",
    icon: "🔄",
  },
  OAuthCreateAccount: {
    title: "Account Creation Failed",
    description: "Something went wrong while creating your account.",
    icon: "👤",
  },
  EmailCreateAccount: {
    title: "Account Creation Failed",
    description: "Something went wrong while creating your account via email.",
    icon: "📧",
  },
  Callback: {
    title: "Callback Error",
    description: "Something went wrong while processing your request.",
    icon: "❌",
  },
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description: "This email address is already registered with a different sign-in method. Try signing in with the original method.",
    icon: "🔗",
  },
  EmailSignin: {
    title: "Email Sending Failed",
    description: "Something went wrong while sending the verification email. Please try again.",
    icon: "📬",
  },
  CredentialsSignin: {
    title: "Sign In Failed",
    description: "The credentials are incorrect. Please check your email and password.",
    icon: "🔑",
  },
  SessionRequired: {
    title: "Session Required",
    description: "You must be signed in to view this page.",
    icon: "🔒",
  },
  // Custom error codes from credentials provider
  email_password_required: {
    title: "Missing Information",
    description: "Please enter both your email and password to sign in.",
    icon: "📝",
  },
  user_not_found: {
    title: "Account Not Found",
    description: "There is no account with this email address. Please create an account first or use a different email address.",
    icon: "🔍",
  },
  no_password_set: {
    title: "No Password Set",
    description: "This account does not have a password yet. Set a password via your account settings, or sign in with Google.",
    icon: "🔒",
  },
  email_not_verified: {
    title: "Email Not Verified",
    description: "Please verify your email before signing in. Check your inbox for the verification link.",
    icon: "✉️",
  },
  invalid_password: {
    title: "Incorrect Password",
    description: "The password is incorrect. Please try again or use 'Forgot Password'.",
    icon: "🔑",
  },
  Default: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again.",
    icon: "😕",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  
  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-red-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-purple-500/20 rounded-full blur-[128px]" />
      </div>
      
      <Card className="max-w-md w-full glass-elevated relative z-10" padding="lg">
        <div className="text-center space-y-4">
          <div className="text-5xl sm:text-6xl">{errorInfo.icon}</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-display">
            {errorInfo.title}
          </h1>
          <p className="text-slate-400">
            {errorInfo.description}
          </p>
          
          {error && error !== "Default" && (
            <p className="text-xs text-slate-600 font-mono">
              Error code: {error}
            </p>
          )}

          <div className="pt-6 space-y-3">
            <Link
              href="/auth/signin"
              className="block w-full btn btn-primary text-center"
            >
              Back to Sign In
            </Link>
            
            {error === "Verification" && (
              <Link
                href="/auth/signin"
                className="block w-full btn btn-secondary text-center"
              >
                Request New Link
              </Link>
            )}
            
            {(error === "EmailSignin" || error === "invalid_password") && (
              <Link
                href="/auth/forgot-password"
                className="block w-full btn btn-secondary text-center"
              >
                Forgot Password?
              </Link>
            )}

            {error === "user_not_found" && (
              <Link
                href="/auth/signup"
                className="block w-full btn btn-secondary text-center"
              >
                Create Account
              </Link>
            )}

            {error === "email_not_verified" && (
              <Link
                href="/auth/signin"
                className="block w-full btn btn-secondary text-center"
              >
                Resend Verification Email
              </Link>
            )}

            {error === "no_password_set" && (
              <Link
                href="/auth/set-password"
                className="block w-full btn btn-secondary text-center"
              >
                Set Password
              </Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="spinner"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
