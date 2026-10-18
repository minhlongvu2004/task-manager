"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createProjectAction } from "@/app/actions/teams";
import type { Priority } from "@/lib/domain/project-view";
import { Dialog, ErrorText, fieldClass, primaryBtn, quietBtn } from "./Dialog";

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

/** Opened by `?new=project` (and `&forTeam=<id>`); closing drops those two and keeps every other filter. */
export function NewProjectDialog({
  teams,
  defaultTeamId,
}: {
  teams: { id: string; name: string }[];
  defaultTeamId?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(teams.find((t) => t.id === defaultTeamId)?.id ?? teams[0]?.id ?? "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    const q = new URLSearchParams(search.toString());
    q.delete("new");
    q.delete("forTeam");
    const s = q.toString();
    router.push(s ? `/?${s}` : "/");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !teamId) return;
    setError(null);
    start(async () => {
      const res = await createProjectAction({ teamId, name, priority, dueDate });
      if (res.ok) router.push(`/projects/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <Dialog title="New project" onClose={close}>
      <form onSubmit={submit}>
        <label className="block text-sm font-medium">
          Project name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={fieldClass} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Team
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={fieldClass}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
          <button type="button" onClick={close} className={quietBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || !teamId || pending} className={primaryBtn}>
            Create project
          </button>
        </div>
      </form>
    </Dialog>
  );
}
