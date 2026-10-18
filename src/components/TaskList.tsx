import { dueState } from "@/lib/domain/project-view";
import type { TaskStatus } from "@/lib/domain/status";

export type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId: string | null;
  dueDate: string | null; // YYYY-MM-DD
  stuckReason: string | null;
};
export type MemberItem = { id: string; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A YYYY-MM-DD date never passes through Date, so no timezone drift.
function formatDue(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function initials(label: string): string {
  return Array.from(label.trim())[0]?.toUpperCase() ?? "?";
}

/** Flat list for the selected tab. Rows show no status text: the tab already says it. */
export function TaskList({
  tasks,
  members,
  today,
  selectedId,
  onSelect,
}: {
  tasks: TaskItem[];
  members: MemberItem[];
  today: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (tasks.length === 0) return <p className="px-[18px] py-8 text-center text-sm text-zinc-500">Nothing here yet.</p>;
  return (
    <ul>
      {tasks.map((t) => {
        const owner = members.find((m) => m.id === t.ownerId);
        const red = t.dueDate !== null && ["soon", "overdue"].includes(dueState(t.dueDate, today));
        return (
          <li key={t.id} className="border-t border-zinc-100 first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect?.(t.id)}
              className={`grid w-full grid-cols-[1fr_auto_64px] items-center gap-2.5 px-[18px] py-2.5 text-left hover:bg-zinc-50 ${
                t.id === selectedId ? "bg-indigo-50" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block break-words">{t.title}</span>
                {t.status === "pending" && t.stuckReason && (
                  <span className="block break-words text-xs text-amber-700">{`Stuck: ${t.stuckReason}`}</span>
                )}
              </span>
              {t.ownerId ? (
                <span
                  title={owner?.label}
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white"
                >
                  {initials(owner?.label ?? "?")}
                </span>
              ) : (
                <span className="rounded-full border border-dashed border-zinc-400 px-2 py-px text-[11px] text-zinc-500">+ assign</span>
              )}
              <span className={`text-right text-xs ${red ? "font-semibold text-red-600" : "text-zinc-500"}`}>
                {t.dueDate ? formatDue(t.dueDate) : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
