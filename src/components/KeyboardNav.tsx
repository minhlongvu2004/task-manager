"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ROW = "[data-project-row]";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("contenteditable") === "true"
  );
}

/**
 * ArrowUp/ArrowDown move focus between project rows; N opens the new-project entry point.
 * Enter needs no code: rows are links, so Enter on a focused row opens it natively.
 */
export function handleProjectKeys(
  e: KeyboardEvent,
  { root, navigate }: { root: ParentNode; navigate: (href: string) => void },
) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
  if (document.querySelector('[role="dialog"]')) return; // a dialog owns the keyboard while open

  if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    // Keep the current filters; the dialog is driven by the URL.
    const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    q.set("new", "project");
    q.delete("forTeam");
    navigate(`?${q.toString()}`);
    return;
  }

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const rows = Array.from(root.querySelectorAll<HTMLElement>(ROW));
    if (rows.length === 0) return;
    e.preventDefault();
    const current = rows.findIndex((r) => r === document.activeElement);
    const next =
      current === -1
        ? e.key === "ArrowDown"
          ? 0
          : rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, current + (e.key === "ArrowDown" ? 1 : -1)));
    rows[next].focus();
  }
}

export function KeyboardNav() {
  const router = useRouter();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handleProjectKeys(e, { root: document, navigate: (h) => router.push(h) });
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [router]);

  return <p className="mt-2 text-xs text-zinc-500">↑ ↓ to move &nbsp;·&nbsp; Enter to open &nbsp;·&nbsp; N for new project</p>;
}
