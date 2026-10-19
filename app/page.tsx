import SignInWithGoogle from "@/components/SignInWithGoogle";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">
        Columbia Meme Admin
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Sign in with your Google account to continue.
      </p>
      <SignInWithGoogle />
    </main>
  );
}
