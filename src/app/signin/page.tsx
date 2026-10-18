import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Task Manager</h1>
        <p className="mt-2 text-sm text-zinc-600">Sign in to continue.</p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
