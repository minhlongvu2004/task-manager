"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setProjectArchivedAction, updateProjectAction } from "@/app/actions/teams";
import type { Priority } from "@/lib/domain/project-view";
import { Dialog, ErrorText, fieldClass, primaryBtn, quietBtn } from "./Dialog";
import { PRIORITY_OPTIONS } from "./NewProjectDialog";

export type ProjectMenuProject = {
  id: string;
  name: string;
  priority: Priority;
  dueDate: string | null;
  archived: boolean;
};

/** Edit and archive controls for one project. There is deliberately no delete: archiving covers it. */
export function ProjectMenu({ project }: { project: ProjectMenuProject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [priority, setPriority] = useState<Priority>(project.priority);
  const [dueDate, setDueDate] = useState(project.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openEdit() {
    setName(project.name);
    setPriority(project.priority);
    setDueDate(project.dueDate ?? "");
    setError(null);
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    start(async () => {
      const res = await updateProjectAction(project.id, { name, priority, dueDate });
      if (res.ok) {
        router.refresh();
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  function toggleArchived() {
    setError(null);
    start(async () => {
      const res = await setProjectArchivedAction(project.id, !project.archived);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={openEdit} className={quietBtn}>
        Edit project
      </button>
      <button type="button" disabled={pending} onClick={toggleArchived} className={`${quietBtn} disabled:opacity-50`}>
        {project.archived ? "Unarchive project" : "Archive project"}
      </button>
      {!open && error && <ErrorText>{error}</ErrorText>}
      {open && (
        <Dialog title="Edit project" onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <label className="block text-sm font-medium">
              Project name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={fieldClass} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Priority
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={fieldClass}>
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Due date
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
              </label>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={quietBtn}>
                Cancel
              </button>
              <button type="submit" disabled={!name.trim() || pending} className={primaryBtn}>
                Save
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
