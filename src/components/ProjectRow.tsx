import Link from "next/link";
import { dueState, type Priority } from "@/lib/domain/project-view";
import { STATUS_LABEL, STATUS_ORDER, type TaskStatus } from "@/lib/domain/status";

export type ProjectRowProject = {
  id: string;
  name: string;
  priority: Priority;
  dueDate: string | null; // YYYY-MM-DD
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Pure string handling: a YYYY-MM-DD date never passes through Date, so no timezone drift.
function formatDue(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  unassigned: "text-zinc-500",
  assigned: "text-zinc-500",
  doing: "text-blue-600",
  pending: "text-amber-600 font-semibold", // amber is reserved for Pending
  succeeded: "text-green-600",
};

export function ProjectRow({
  project,
  counts,
  today,
  archived = false,
}: {
  project: ProjectRowProject;
  counts: Record<TaskStatus, number>;
  today: string;
  archived?: boolean;
}) {
  const state = dueState(project.dueDate, today);
  const dueRed = state === "soon" || state === "overdue";
  return (
    <Link
      href={`/projects/${project.id}`}
      data-project-row
      className="grid grid-cols-1 items-center gap-x-3 gap-y-1 rounded-lg px-1.5 py-2.5 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_64px]"
    >
      <span className="min-w-0 truncate">
        <span className="font-medium">{project.name}</span>
        {archived && (
          <span className="ml-2 rounded-md bg-zinc-100 px-1.5 py-0.5 align-[1px] text-[10px] font-bold tracking-wider text-zinc-600">
            Archived
          </span>
        )}
        {project.priority === "urgent" && (
          <span className="ml-2 rounded-md bg-red-100 px-1.5 py-0.5 align-[1px] text-[10px] font-bold tracking-wider text-red-700">
            URGENT
          </span>
        )}
        {project.priority === "high" && (
          <span className="ml-2 rounded-md bg-orange-100 px-1.5 py-0.5 align-[1px] text-[10px] font-bold tracking-wider text-orange-700">
            HIGH
          </span>
        )}
      </span>
      <span className="flex flex-wrap gap-x-3.5 text-xs">
        {STATUS_ORDER.map((s) => (
          <span key={s} className={counts[s] === 0 ? "text-zinc-300" : STATUS_TEXT[s]}>
            {`${counts[s]} ${STATUS_LABEL[s]}`}
          </span>
        ))}
      </span>
      <span
        data-testid="due"
        className={`text-xs sm:text-right ${dueRed ? "font-semibold text-red-600" : "text-zinc-500"}`}
      >
        {project.dueDate ? formatDue(project.dueDate) : ""}
      </span>
    </Link>
  );
}
