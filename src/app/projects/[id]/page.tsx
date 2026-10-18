import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ProjectMenu } from "@/components/ProjectMenu";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { Sidebar } from "@/components/Sidebar";
import { safeColor } from "@/components/TeamCard";
import type { TaskItem } from "@/components/TaskList";
import { resolveTab, type Priority } from "@/lib/domain/project-view";
import { getSessionUser } from "@/server/access";
import { NotFoundError } from "@/server/errors";
import { getProject } from "@/server/projects";
import { listTasks, taskCounts } from "@/server/tasks";
import { listTeamMembers, listTeams } from "@/server/teams";

// Server-local calendar date as YYYY-MM-DD (en-CA formats this way).
function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const PRIORITY_LABEL: Record<Priority, string> = { urgent: "URGENT", high: "HIGH", normal: "NORMAL" };
const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: "bg-red-100 text-red-700", // red is reserved for urgent and near-due
  high: "bg-zinc-200 text-zinc-700",
  normal: "bg-zinc-100 text-zinc-600",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading project...</p>}>
      <ProjectContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectContent({ params, searchParams }: Pick<PageProps<"/projects/[id]">, "params" | "searchParams">) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const query = await searchParams;
  const active = resolveTab(typeof query.tab === "string" ? query.tab : undefined);

  let project;
  try {
    project = await getProject(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound(); // non-members see "not found", never the data
    throw e;
  }

  const [counts, rows, members, teams] = await Promise.all([
    taskCounts(user, id),
    listTasks(user, id, active),
    listTeamMembers(user, project.teamId),
    listTeams(user),
  ]);
  const team = teams.find((t) => t.id === project.teamId);
  const color = safeColor(team?.color ?? null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Drizzle rows carry Date objects; the client gets plain strings only.
  const items: TaskItem[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    ownerId: t.ownerId,
    dueDate: t.dueDate,
    stuckReason: t.stuckReason,
  }));
  const memberItems = members.map((m) => ({ id: m.id, label: m.name?.trim() || m.email }));
  const due = project.dueDate ? project.dueDate.split("-").map(Number) : null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 sm:flex-row">
      <Sidebar />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-8 sm:px-7">
        <Link href="/" className="inline-block py-3 text-sm text-zinc-500 hover:text-zinc-800">
          &larr; Projects
        </Link>
        <header
          className="mb-4 rounded-2xl border border-zinc-200 px-[18px] py-4"
          style={{ background: `color-mix(in srgb, ${color} 12%, white)` }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold leading-tight">{project.name}</h1>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${PRIORITY_STYLE[project.priority]}`}>
              {PRIORITY_LABEL[project.priority]}
            </span>
            {project.state === "archived" && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">ARCHIVED</span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <ProjectMenu
                project={{
                  id,
                  name: project.name,
                  priority: project.priority,
                  dueDate: project.dueDate,
                  archived: project.state === "archived",
                }}
              />
              <Link href={`/projects/${id}/trash`} className="text-xs text-zinc-500 hover:text-zinc-800">
                Trash
              </Link>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600">
            {[
              team?.name,
              due ? `Due ${MONTHS[due[1] - 1]} ${due[2]}` : null,
              `${total} ${total === 1 ? "task" : "tasks"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
        <ProjectWorkspace
          projectId={id}
          tasks={items}
          counts={counts}
          active={active}
          members={memberItems}
          today={localToday()}
        />
      </main>
    </div>
  );
}
