import Link from "next/link";
import { STATUS_LABEL, STATUS_ORDER, type TaskStatus } from "@/lib/domain/status";

/** Five tabs in workflow order, a thin divider before Succeeded, and "+ New task" at the right on every tab. */
export function StatusTabs({
  counts,
  active,
  onNewTask,
}: {
  counts: Record<TaskStatus, number>;
  active: TaskStatus;
  onNewTask?: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-zinc-200 px-3">
      <nav aria-label="Task status" className="flex items-center">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center">
            {s === "succeeded" && <span role="separator" aria-orientation="vertical" className="mx-2 h-[18px] w-px bg-zinc-300" />}
            <Link
              href={`?tab=${s}`}
              aria-current={s === active ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm ${
                s === active ? "border-indigo-700 font-semibold text-indigo-700" : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {STATUS_LABEL[s]}
              <span className={`ml-1 ${s === "pending" ? "font-bold text-amber-600" : "text-zinc-500"}`} data-count={s}>
                {counts[s]}
              </span>
            </Link>
          </span>
        ))}
      </nav>
      <button
        type="button"
        onClick={onNewTask}
        className="ml-auto whitespace-nowrap rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800"
      >
        + New task
      </button>
    </div>
  );
}
