import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import AdminShell from "@/components/admin/AdminShell";

// Every route under /admin renders inside this gate. proxy.ts enforces the
// same check before the request reaches here, and each page calls
// requireSuperadmin() again because layouts don't re-run on client navigation.
async function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();

  return (
    <AdminShell
      account={
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm text-zinc-600 sm:block dark:text-zinc-400">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      }
    >
      {children}
    </AdminShell>
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
