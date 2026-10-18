import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getSessionUser } from "@/server/access";
import { NotFoundError } from "@/server/errors";
import { getProject } from "@/server/projects";
import { listTrash } from "@/server/tasks";
import { restoreTaskAction } from "../actions";

export default function TrashPage({ params }: PageProps<"/projects/[id]/trash">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading trash...</p>}>
      <TrashContent params={params} />
    </Suspense>
  );
}

async function TrashContent({ params }: Pick<PageProps<"/projects/[id]/trash">, "params">) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const { id } = await params;

  let project;
  let rows;
  try {
    project = await getProject(user, id);
    rows = await listTrash(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 sm:flex-row">
      <Sidebar />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-8 sm:px-7">
        <Link href={`/projects/${id}`} className="inline-block py-3 text-sm text-zinc-500 hover:text-zinc-800">
          &larr; {project.name}
        </Link>
        <h1 className="mb-1 text-lg font-bold">Trash</h1>
        <p className="mb-4 text-xs text-zinc-500">Deleted tasks are removed for good after 30 days.</p>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
            Trash is empty
          </p>
        ) : (
          <ul className="rounded-xl border border-zinc-200 bg-white">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-t border-zinc-100 px-4 py-2.5 first:border-t-0">
                <span className="min-w-0 flex-1 break-words">{t.title}</span>
                <form
                  action={async () => {
                    "use server";
                    await restoreTaskAction(t.id);
                  }}
                >
                  <button type="submit" className="text-sm font-semibold text-indigo-700 hover:underline">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
