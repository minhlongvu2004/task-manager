import Link from "next/link";
import type { TaskStatus } from "@/lib/domain/status";
import { ProjectRow, type ProjectRowProject } from "./ProjectRow";

export type TeamCardProject = ProjectRowProject & { counts: Record<TaskStatus, number> };
export type TeamCardTeam = { id: string; name: string; color: string | null };

const DEFAULT_COLOR = "#64748b";

// Only plain hex colors reach the style attribute.
function safeColor(color: string | null): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : DEFAULT_COLOR;
}

/** `projects` must already be in display order (sortProjects). `today` is YYYY-MM-DD. */
export function TeamCard({
  team,
  projects,
  today,
  memberCount,
}: {
  team: TeamCardTeam;
  projects: TeamCardProject[];
  today: string;
  memberCount?: number;
}) {
  const color = safeColor(team.color);
  const pending = projects.reduce((sum, p) => sum + p.counts.pending, 0);
  const summary = [
    `${projects.length} ${projects.length === 1 ? "project" : "projects"}`,
    memberCount === undefined ? null : `${memberCount} ${memberCount === 1 ? "person" : "people"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      style={
        {
          "--c": color,
          "--tint": `color-mix(in srgb, ${color} 12%, white)`,
          borderLeftColor: color,
        } as React.CSSProperties
      }
      className="mb-5 overflow-hidden rounded-2xl border border-l-[6px] border-zinc-200 bg-white shadow-sm"
    >
      <header className="flex items-center gap-3 px-[18px] py-3.5" style={{ background: "var(--tint)" }}>
        <div
          aria-hidden
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] text-lg font-bold text-white"
          style={{ background: "var(--c)" }}
        >
          {Array.from(team.name.trim())[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[21px] font-bold leading-tight">{team.name}</h2>
          <p className="mt-0.5 text-xs text-zinc-600">{summary}</p>
        </div>
        {pending > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
            {`${pending} pending`}
          </span>
        )}
      </header>
      <div className="px-[18px] pb-1.5 pt-2">
        <div className="ml-1.5 border-l-2 border-zinc-100 pl-4">
          {projects.map((p) => (
            <div key={p.id} className="border-t border-zinc-100 first:border-t-0">
              <ProjectRow project={p} counts={p.counts} today={today} />
            </div>
          ))}
          <Link
            href="?new=project"
            className="block rounded-lg px-1.5 py-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          >
            + Add project
          </Link>
        </div>
      </div>
    </section>
  );
}
