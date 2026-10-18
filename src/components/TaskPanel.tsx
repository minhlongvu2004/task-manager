"use client";
import { useState } from "react";
import { STATUS_LABEL, STATUS_ORDER, type TaskStatus } from "@/lib/domain/status";
import { setOwner, validateTitle, type TaskState } from "@/lib/domain/task-rules";
import type { MemberItem, TaskItem } from "./TaskList";

export type TaskFormValues = {
  title: string;
  status: TaskStatus;
  ownerId: string | null;
  dueDate: string | null;
  stuckReason: string;
};
export type SubmitResult = { ok: true } | { ok: false; error: string } | void;

const fld = "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900";
const lbl = "mb-0.5 mt-2.5 block text-[11px] text-zinc-500";

export function TaskPanel({
  mode,
  task,
  members,
  onSubmit,
  onDelete,
  onClose,
}: {
  mode: "create" | "edit";
  task?: TaskItem;
  members: MemberItem[];
  onSubmit: (values: TaskFormValues) => Promise<SubmitResult> | SubmitResult;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const edit = mode === "edit" && task !== undefined;
  const [title, setTitle] = useState(edit ? task.title : "");
  const [status, setStatus] = useState<TaskStatus>(edit ? task.status : "unassigned");
  const [ownerId, setOwnerId] = useState<string | null>(edit ? task.ownerId : null);
  const [dueDate, setDueDate] = useState(edit ? (task.dueDate ?? "") : "");
  const [reason, setReason] = useState(edit ? (task.stuckReason ?? "") : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const titleOk = validateTitle(title).ok;
  const needsOwner = status !== "unassigned" && ownerId === null;
  const needsReason = status === "pending" && reason.trim() === "";
  const canSave = titleOk && !needsOwner && !needsReason && !busy;
  // From Doing onward a task keeps its owner, so "Nobody" is not offered.
  const allowNobody = status === "unassigned" || status === "assigned";

  function changeOwner(value: string) {
    const state: TaskState = { status, ownerId, stuckReason: null };
    const r = setOwner(state, value === "" ? null : value);
    if (r.ok) {
      setStatus(r.state.status);
      setOwnerId(r.state.ownerId);
    }
  }

  function changeStatus(value: string) {
    const next = STATUS_ORDER.find((s) => s === value);
    if (!next) return;
    setStatus(next);
    if (next === "unassigned") setOwnerId(null);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onSubmit({
        title: title.trim(),
        status,
        ownerId,
        dueDate: dueDate === "" ? null : dueDate,
        stuckReason: status === "pending" ? reason.trim() : "",
      });
      if (res && !res.ok) setError(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label={edit ? "Edit task" : "New task"}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="w-full border-t border-zinc-200 bg-white p-4 lg:w-[330px] lg:shrink-0 lg:border-l lg:border-t-0"
    >
      <h2 className="mb-2.5 text-base font-bold">{edit ? "Task" : "New task"}</h2>
      <label htmlFor="tp-title" className="sr-only">
        Title
      </label>
      <input
        id="tp-title"
        autoFocus
        autoComplete="off"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${fld} border-2 border-indigo-700 text-[15px]`}
      />
      {edit && (
        <>
          <label htmlFor="tp-status" className={lbl}>
            Status
          </label>
          <select id="tp-status" value={status} onChange={(e) => changeStatus(e.target.value)} className={fld}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="tp-owner" className={lbl}>
        {edit ? "Owner" : "Owner (optional)"}
      </label>
      <select id="tp-owner" value={ownerId ?? ""} onChange={(e) => changeOwner(e.target.value)} className={fld}>
        {allowNobody && <option value="">Nobody</option>}
        {ownerId === null && !allowNobody && <option value="">Choose an owner</option>}
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {needsOwner && <p className="mt-1 text-xs text-red-600">Choose an owner for this status.</p>}
      {status === "pending" && (
        <>
          <label htmlFor="tp-reason" className={lbl}>
            Why is it stuck?
          </label>
          <input
            id="tp-reason"
            required
            placeholder="e.g. waiting for API key"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={fld}
          />
        </>
      )}
      <label htmlFor="tp-due" className={lbl}>
        {edit ? "Due date" : "Due date (optional)"}
      </label>
      <input id="tp-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fld} />
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between">
        <span>
          {edit && (
            <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">
              Delete
            </button>
          )}
        </span>
        <span className="flex items-center gap-3.5">
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-md bg-indigo-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-40"
          >
            {edit ? "Save" : "Create task"}
          </button>
        </span>
      </div>
    </form>
  );
}
