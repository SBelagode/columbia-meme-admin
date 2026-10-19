import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import AdminNav from "@/components/admin/AdminNav";

// Every route under /admin renders inside this gate. proxy.ts enforces the
// same check before the request reaches here, and each page calls
// requireSuperadmin() again because layouts don't re-run on client navigation.
async function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Columbia Meme Admin</span>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-zinc-200 p-2 md:w-52 md:shrink-0 md:border-b-0 md:border-r dark:border-zinc-800">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 font-sans md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={<p className="p-4 text-sm text-zinc-500">Checking access…</p>}
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
