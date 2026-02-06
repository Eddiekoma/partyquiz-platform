import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log("[DASHBOARD-LAYOUT] All cookies received:", allCookies.map(c => `${c.name}=${c.value.substring(0, 30)}...`));
  
  const session = await auth();
  console.log("[DASHBOARD-LAYOUT] Session result:", session ? { userId: session.user?.id, email: session.user?.email } : null);

  if (!session?.user) {
    console.log("[DASHBOARD-LAYOUT] No session - redirecting to signin");
    redirect("/auth/signin");
  }
  
  console.log("[DASHBOARD-LAYOUT] Session valid - rendering dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav user={session.user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
