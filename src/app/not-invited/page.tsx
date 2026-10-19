import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

export default function NotInvitedPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">This email is not invited</h1>
        <Suspense fallback={<p className="mt-2 text-sm text-zinc-600">Please contact the host.</p>}>
          <HostContact />
        </Suspense>
        <Link
          href="/signin"
          className="mt-6 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

// Read per request so OWNER_EMAIL comes from the runtime environment, not the build.
async function HostContact() {
  await connection();
  const host = process.env.OWNER_EMAIL;
  return (
    <p className="mt-2 text-sm text-zinc-600">
      Please contact the host
      {host ? (
        <>
          {" "}at{" "}
          <a className="font-medium text-zinc-900 underline underline-offset-4" href={`mailto:${host}`}>
            {host}
          </a>
        </>
      ) : null}
      .
    </p>
  );
}
