"use client";
import { useState, useTransition } from "react";
import { restoreTaskAction } from "@/app/projects/[id]/actions";
import { ErrorText } from "./Dialog";

/** Restores one trashed task and shows the reason when it can't be restored. */
export function RestoreButton({ taskId }: { taskId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await restoreTaskAction(taskId);
            if (!res.ok) setError(res.error);
          })
        }
        className="text-sm font-semibold text-indigo-700 hover:underline disabled:opacity-50"
      >
        Restore
      </button>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
