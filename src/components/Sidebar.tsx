import Link from "next/link";

// Version 1 sidebar: Projects only.
export function Sidebar() {
  return (
    <aside className="border-b border-zinc-200 bg-white p-3 sm:w-[200px] sm:shrink-0 sm:border-b-0 sm:border-r sm:px-2.5 sm:py-4">
      <div className="mb-3 px-2 text-sm font-bold">Task Manager</div>
      <nav aria-label="Main">
        <Link
          href="/"
          aria-current="page"
          className="block rounded-md bg-indigo-50 px-2.5 py-1.5 text-sm font-semibold text-indigo-700"
        >
          Projects
        </Link>
      </nav>
    </aside>
  );
}
