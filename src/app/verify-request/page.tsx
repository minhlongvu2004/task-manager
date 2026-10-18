import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-zinc-600">If that address is invited, a sign-in link is on its way.</p>
        <Link href="/signin" className="mt-6 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
