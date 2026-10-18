import type { Priority } from "@/lib/domain/project-view";

/** URGENT is red, HIGH is orange, normal shows nothing. */
export function PriorityLabel({ priority, className = "ml-2" }: { priority: Priority; className?: string }) {
  if (priority === "urgent") {
    return (
      <span className={`${className} rounded-md bg-red-100 px-1.5 py-0.5 align-[1px] text-[10px] font-bold tracking-wider text-red-700`}>
        URGENT
      </span>
    );
  }
  if (priority === "high") {
    return (
      <span className={`${className} rounded-md bg-orange-100 px-1.5 py-0.5 align-[1px] text-[10px] font-bold tracking-wider text-orange-700`}>
        HIGH
      </span>
    );
  }
  return null;
}
