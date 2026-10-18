import { STATUS_ORDER, type TaskStatus } from "./status";

export type Priority = "urgent" | "high" | "normal";

export type DueState = "none" | "overdue" | "soon" | "later";

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2 };

const MS_PER_DAY = 86_400_000;

// Ascending by YYYY-MM-DD; a missing date sorts after every real date.
function compareDueDate(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortProjects<T extends { priority: Priority; dueDate: string | null; name: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      compareDueDate(a.dueDate, b.dueDate) ||
      compareText(a.name, b.name),
  );
}

// createdAt is an ISO-8601 timestamp.
export function sortTasks<T extends { dueDate: string | null; createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      compareDueDate(a.dueDate, b.dueDate) ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}

/** The Projects screen hides archived projects; the Archived filter shows only those. */
export function filterByArchived<T extends { state: string }>(items: T[], archived: boolean): T[] {
  return items.filter((p) => (p.state === "archived") === archived);
}

export function resolveTab(query: string | undefined): TaskStatus {
  return STATUS_ORDER.find((s) => s === query) ?? "doing";
}

export function countsByStatus(tasks: { status: TaskStatus }[]): Record<TaskStatus, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}

// Converts YYYY-MM-DD to a UTC day number so the difference is calendar days.
function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function dueState(dueDate: string | null, today: string): DueState {
  if (dueDate === null) return "none";
  const days = dayNumber(dueDate) - dayNumber(today);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "later";
}
