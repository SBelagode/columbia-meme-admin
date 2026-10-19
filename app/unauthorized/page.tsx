import SignOutButton from "@/components/SignOutButton";

export default function UnauthorizedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Not authorized</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your account does not have admin access.
      </p>
      <SignOutButton />
    </main>
  );
}
