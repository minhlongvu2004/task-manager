"use client";
import { useEffect, useId, useRef } from "react";

const FOCUSABLE = 'input, select, textarea, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog shell: labelled by its title, Escape closes, the first field is focused on open,
 * focus returns to whatever had it before on close, and Tab stays inside.
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const el = box.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = el?.querySelector<HTMLElement>("input, select, textarea") ?? el;
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      } else if (e.key === "Tab" && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => !n.hasAttribute("disabled"));
        if (items.length === 0) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-zinc-900/40 p-4 pt-[10vh]">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl focus:outline-none"
      >
        <div className="mb-3 flex items-center">
          <h2 id={titleId} className="flex-1 text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Error text from a failed action. Neutral tone: red is reserved for urgent and near-due. */
export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-900">
      {children}
    </p>
  );
}

export const fieldClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
export const primaryBtn =
  "rounded-md bg-indigo-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50";
export const quietBtn = "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50";
