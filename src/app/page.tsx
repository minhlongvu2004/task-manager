import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { KeyboardNav } from "@/components/KeyboardNav";
import { Sidebar } from "@/components/Sidebar";
import { TeamCard, type TeamCardProject } from "@/components/TeamCard";
import { getSessionUser } from "@/server/access";
import { listProjects } from "@/server/projects";
import { taskCounts } from "@/server/tasks";
import { listTeamMembers, listTeams } from "@/server/teams";

// Server-local calendar date as YYYY-MM-DD (en-CA formats this way), computed once per request.
function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function href(team: string | undefined, pending: boolean): string {
  const q = new URLSearchParams();
  if (team) q.set("team", team);
  if (pending) q.set("pending", "1");
  const s = q.toString();
  return s ? `/?${s}` : "/";
}

const chip = "rounded-md border px-2.5 py-1 text-sm";
const chipOff = `${chip} border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50`;
const chipOn = `${chip} border-indigo-300 bg-indigo-50 font-medium text-indigo-700`;

// cacheComponents: session and DB reads are request-time data, so they stream inside Suspense.
export default function ProjectsPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading projects...</p>}>
      <ProjectsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectsContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const params = await searchParams;
  const teamParam = typeof params.team === "string" ? params.team : undefined;
  const onlyPending = params.pending === "1";

  const [teams, projects] = await Promise.all([listTeams(user), listProjects(user, { includeArchived: false })]);
  const activeTeam = teams.find((t) => t.id === teamParam)?.id;

  const withCounts: (TeamCardProject & { teamId: string })[] = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      teamId: p.teamId,
      name: p.name,
      priority: p.priority,
      dueDate: p.dueDate,
      counts: await taskCounts(user, p.id),
    })),
  );

  const today = localToday();
  const shown = teams.filter((t) => !activeTeam || t.id === activeTeam);
  const cards = await Promise.all(
    shown.map(async (team) => {
      const mine = withCounts.filter((p) => p.teamId === team.id && (!onlyPending || p.counts.pending > 0)); // already sorted by listProjects
      const memberCount = (await listTeamMembers(user, team.id)).length;
      return { team, projects: mine, memberCount };
    }),
  );
  const visible = onlyPending ? cards.filter((c) => c.projects.length > 0) : cards;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 sm:flex-row">
      <Sidebar />
      <main className="mx-auto w-full max-w-[980px] flex-1 px-4 pb-8 sm:px-7">
        <div className="flex flex-wrap items-center gap-2.5 py-4">
          <h1 className="flex-1 text-lg font-bold">Projects</h1>
          <Link href={href(undefined, onlyPending)} className={activeTeam ? chipOff : chipOn}>
            All teams
          </Link>
          {teams.map((t) => (
            <Link key={t.id} href={href(t.id, onlyPending)} className={activeTeam === t.id ? chipOn : chipOff}>
              {t.name}
            </Link>
          ))}
          <Link href={href(activeTeam, !onlyPending)} className={onlyPending ? chipOn : chipOff}>
            Has Pending
          </Link>
          <Link
            href="?new=project"
            className="rounded-md bg-indigo-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            + New
          </Link>
        </div>

        {teams.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
            No teams yet
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
            No projects with pending tasks
          </p>
        ) : (
          visible.map((c) => (
            <TeamCard key={c.team.id} team={c.team} projects={c.projects} today={today} memberCount={c.memberCount} />
          ))
        )}
        <KeyboardNav />
      </main>
    </div>
  );
}
