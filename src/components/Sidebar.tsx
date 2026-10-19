import Link from "next/link";
import { signOut } from "@/auth";

const navProps = (active: boolean) => ({
  "aria-current": active ? ("page" as const) : undefined,
  className: `block rounded-md px-2.5 py-1.5 text-sm ${
    active ? "bg-indigo-50 font-semibold text-indigo-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
  }`,
});

// Sidebar: Projects, People (owner only) and Sign out.
export function Sidebar({ current = "projects", showPeople = false }: { current?: "projects" | "people"; showPeople?: boolean }) {
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }
  return (
    <aside className="flex flex-col border-b border-zinc-200 bg-white p-3 sm:w-[200px] sm:shrink-0 sm:border-b-0 sm:border-r sm:px-2.5 sm:py-4">
      <div className="mb-3 px-2 text-sm font-bold">Task Manager</div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <Link href="/" {...navProps(current === "projects")}>
          Projects
        </Link>
        {showPeople && (
          <Link href="/people" {...navProps(current === "people")}>
            People
          </Link>
        )}
      </nav>
      <form action={signOutAction} className="mt-2 sm:mt-auto sm:pt-4">
        <button
          type="submit"
          className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
