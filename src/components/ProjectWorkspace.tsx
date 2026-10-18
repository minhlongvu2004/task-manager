"use client";
import { useCallback, useState } from "react";
import {
  createTaskAction,
  deleteTaskAction,
  restoreTaskAction,
  updateTaskAction,
  type ActionResult,
} from "@/app/projects/[id]/actions";
import type { TaskStatus } from "@/lib/domain/status";
import { StatusTabs } from "./StatusTabs";
import { TaskList, type MemberItem, type TaskItem } from "./TaskList";
import { TaskPanel, type TaskFormValues } from "./TaskPanel";
import { Toast } from "./Toast";

/** Sends only what changed, so rules like "a Doing task keeps its owner" are not tripped by untouched fields. */
export function buildPatch(task: TaskItem, v: TaskFormValues) {
  const patch: { title: string; dueDate: string | null; status?: TaskStatus; ownerId?: string | null; stuckReason?: string } = {
    title: v.title,
    dueDate: v.dueDate,
  };
  const statusChanged = v.status !== task.status;
  if (statusChanged) patch.status = v.status;
  // Moving to Unassigned clears the owner by itself.
  if (v.ownerId !== task.ownerId && !(statusChanged && v.status === "unassigned")) patch.ownerId = v.ownerId;
  if (v.status === "pending") patch.stuckReason = v.stuckReason;
  return patch;
}

type Open = { kind: "new" } | { kind: "edit"; id: string } | null;

/**
 * Tabs, list, side panel and undo toast. The panel is client state (not a URL param):
 * only the selected tab lives in `?tab=`, so opening the panel never reloads the server page.
 */
export function ProjectWorkspace({
  projectId,
  tasks,
  counts,
  active,
  members,
  today,
}: {
  projectId: string;
  tasks: TaskItem[];
  counts: Record<TaskStatus, number>;
  active: TaskStatus;
  members: MemberItem[];
  today: string;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [toast, setToast] = useState<{ id: string } | null>(null);
  const editing = open?.kind === "edit" ? tasks.find((t) => t.id === open.id) : undefined;
  const expire = useCallback(() => setToast(null), []);

  async function finish(res: ActionResult): Promise<ActionResult> {
    if (res.ok) setOpen(null);
    return res;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <StatusTabs counts={counts} active={active} onNewTask={() => setOpen({ kind: "new" })} />
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <TaskList
            tasks={tasks}
            members={members}
            today={today}
            selectedId={editing?.id}
            onSelect={(id) => setOpen({ kind: "edit", id })}
          />
        </div>
        {open?.kind === "new" && (
          <TaskPanel
            key="new"
            mode="create"
            members={members}
            onClose={() => setOpen(null)}
            onSubmit={async (v) =>
              finish(await createTaskAction(projectId, { title: v.title, ownerId: v.ownerId, dueDate: v.dueDate }))
            }
          />
        )}
        {open?.kind === "edit" && editing && (
          <TaskPanel
            key={editing.id}
            mode="edit"
            task={editing}
            members={members}
            onClose={() => setOpen(null)}
            onSubmit={async (v) => finish(await updateTaskAction(editing.id, buildPatch(editing, v)))}
            onDelete={async () => {
              const res = await deleteTaskAction(editing.id);
              if (res.ok) {
                setOpen(null);
                setToast({ id: editing.id });
              }
            }}
          />
        )}
      </div>
      {toast && (
        <Toast
          key={toast.id}
          message="Task deleted"
          onExpire={expire}
          onUndo={async () => {
            await restoreTaskAction(toast.id);
            setToast(null);
          }}
        />
      )}
    </div>
  );
}
