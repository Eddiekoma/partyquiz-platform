import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

type PageProps = {
  searchParams?: {
    callbackUrl?: string | string[];
    verified?: string | string[];
    error?: string | string[];
  };
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sanitizeCallbackUrl(rawCallbackUrl: string | undefined) {
  const fallback = "/dashboard";
  if (!rawCallbackUrl) return fallback;

  const trimmed = rawCallbackUrl.trim();
  if (!trimmed) return fallback;

  // If it's an absolute URL, only allow same-origin as NEXTAUTH_URL.
  try {
    const parsed = new URL(trimmed);
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    if (!nextAuthUrl) return fallback;

    const nextAuthOrigin = new URL(nextAuthUrl).origin;
    if (parsed.origin !== nextAuthOrigin) return fallback;

    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (safePath.startsWith("/auth") || safePath.startsWith("/api/auth")) return fallback;
    return safePath || fallback;
  } catch {
    // Not an absolute URL → treat as path.
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.startsWith("/auth") || trimmed.startsWith("/api/auth")) return fallback;
  return trimmed;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const callbackUrl = sanitizeCallbackUrl(firstParam(searchParams?.callbackUrl));
  const verified = firstParam(searchParams?.verified) === "true";
  const authError = firstParam(searchParams?.error) ?? null;

  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  return <SignInForm callbackUrl={callbackUrl} verified={verified} authError={authError} />;
}

