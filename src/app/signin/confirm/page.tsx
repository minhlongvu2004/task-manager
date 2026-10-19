import { Suspense } from "react";
import { redirect } from "next/navigation";
import { safeCallbackPath } from "@/server/email";

// Opening this page changes nothing, so mail scanners that fetch the emailed link do not spend the
// one-time token. Only pressing the button (a POST) sends the browser on to the real callback.
export default function ConfirmSignInPage({ searchParams }: PageProps<"/signin/confirm">) {
  // cacheComponents: searchParams is request-time data, so it is read inside Suspense.
  return (
    <Suspense fallback={null}>
      <ConfirmContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ConfirmContent({ searchParams }: Pick<PageProps<"/signin/confirm">, "searchParams">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const target = safeCallbackPath(next);
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Task Manager</h1>
        {target ? (
          <>
            <p className="mt-2 text-sm text-zinc-600">Press the button to finish signing in.</p>
            <form
              className="mt-6"
              action={async () => {
                "use server";
                redirect(target);
              }}
            >
              <button
                type="submit"
                className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
              >
                Sign in
              </button>
            </form>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">This sign-in link is not valid. Request a new one from the sign-in page.</p>
        )}
      </div>
    </main>
  );
}
