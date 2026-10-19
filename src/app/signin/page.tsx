import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signIn } from "@/auth";
import { isEmailAllowed } from "@/server/access";

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
        <Suspense>
          <EmailForm />
        </Suspense>
      </div>
    </main>
  );
}

// Rendered per request so AUTH_RESEND_KEY is read at runtime, not baked in at build time.
async function EmailForm() {
  await connection();
  if (!process.env.AUTH_RESEND_KEY) return null;
  return (
      <>
        <p className="my-4 text-xs text-zinc-500">or</p>
        <form
          className="space-y-3"
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "");
            // Say so plainly when the address is not invited, instead of sending nothing.
            if (!(await isEmailAllowed(email))) redirect("/not-invited");
            await signIn("resend", { email, redirectTo: "/" });
          }}
        >
          <label className="sr-only" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          />
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Email me a link
          </button>
        </form>
      </>
  );
}
