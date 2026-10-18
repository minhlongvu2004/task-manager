"use client";
import { useEffect, useRef } from "react";

export const TOAST_MS = 4000;

/** Shows a message with an optional Undo, then calls onExpire after ~4 seconds. */
export function Toast({
  message,
  onUndo,
  undoDisabled = false,
  onExpire,
  duration = TOAST_MS,
}: {
  message: string;
  onUndo?: () => void;
  undoDisabled?: boolean;
  onExpire: () => void;
  duration?: number;
}) {
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    const id = setTimeout(() => expire.current(), duration);
    return () => clearTimeout(id);
  }, [duration]);
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          disabled={undoDisabled}
          className="ml-3 font-semibold text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
        >
          Undo
        </button>
      )}
    </div>
  );
}
