import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { KeyboardNav } from "@/components/KeyboardNav";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { NewTeamButton } from "@/components/NewTeamDialog";
import { Sidebar } from "@/components/Sidebar";
import { TeamCard, type TeamCardProject } from "@/components/TeamCard";
import { filterByArchived } from "@/lib/domain/project-view";
import { localToday } from "@/lib/today";
import { getSessionUser } from "@/server/access";
import { listProjects } from "@/server/projects";
import { taskCounts } from "@/server/tasks";
import { listTeamMembers, listTeams } from "@/server/teams";

type Filters = { team?: string; pending: boolean; archived: boolean };

function href(f: Filters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (f.team) q.set("team", f.team);
  if (f.pending) q.set("pending", "1");
  if (f.archived) q.set("archived", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
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
  const showArchived = params.archived === "1";

  const [teams, allProjects] = await Promise.all([listTeams(user), listProjects(user, { includeArchived: true })]);
  const projects = filterByArchived(allProjects, showArchived);
  const activeTeam = teams.find((t) => t.id === teamParam)?.id;
  const forTeam = typeof params.forTeam === "string" ? teams.find((t) => t.id === params.forTeam)?.id : undefined;
  const filters: Filters = { team: activeTeam, pending: onlyPending, archived: showArchived };

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
      const members = await listTeamMembers(user, team.id);
      return { team, projects: mine, members };
    }),
  );
  const visible = onlyPending || showArchived ? cards.filter((c) => c.projects.length > 0) : cards;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 sm:flex-row">
      <Sidebar showPeople={user.isWorkspaceOwner} />
      <main className="mx-auto w-full max-w-[980px] flex-1 px-4 pb-8 sm:px-7">
        <div className="flex flex-wrap items-center gap-2.5 py-4">
          <h1 className="flex-1 text-lg font-bold">Projects</h1>
          <Link href={href({ ...filters, team: undefined })} className={activeTeam ? chipOff : chipOn}>
            All teams
          </Link>
          {teams.map((t) => (
            <Link key={t.id} href={href({ ...filters, team: t.id })} className={activeTeam === t.id ? chipOn : chipOff}>
              {t.name}
            </Link>
          ))}
          <Link href={href({ ...filters, pending: !onlyPending })} className={onlyPending ? chipOn : chipOff}>
            Has Pending
          </Link>
          <Link href={href({ ...filters, archived: !showArchived })} className={showArchived ? chipOn : chipOff}>
            Archived
          </Link>
          <NewTeamButton className={`${chipOff} font-medium`} />
          <Link
            href={href(filters, { new: "project" })}
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
            {showArchived ? "No archived projects" : "No projects with pending tasks"}
          </p>
        ) : (
          visible.map((c) => (
            <TeamCard key={c.team.id} team={c.team} projects={c.projects} today={today} memberCount={c.members.length}
              members={c.members}
              archived={showArchived}
              newProjectHref={href(filters, { new: "project", forTeam: c.team.id })}
            />
          ))
        )}
        <KeyboardNav />
        {params.new === "project" && teams.length > 0 && (
          <NewProjectDialog teams={teams.map((t) => ({ id: t.id, name: t.name }))} defaultTeamId={forTeam ?? activeTeam} />
        )}
      </main>
    </div>
  );
}
