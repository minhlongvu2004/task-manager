export type TaskStatus = "unassigned" | "assigned" | "doing" | "pending" | "succeeded";

export const STATUS_ORDER: TaskStatus[] = ["unassigned", "assigned", "doing", "pending", "succeeded"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  doing: "Doing",
  pending: "Pending",
  succeeded: "Succeeded",
};
