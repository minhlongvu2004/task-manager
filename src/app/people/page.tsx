import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { InvitePeople } from "@/components/InvitePeople";
import { Sidebar } from "@/components/Sidebar";
import { getSessionUser } from "@/server/access";
import { listInvited } from "@/server/people";

// cacheComponents: session and DB reads are request-time data, so they stream inside Suspense.
export default function PeoplePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading...</p>}>
      <PeopleContent />
    </Suspense>
  );
}

async function PeopleContent() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!user.isWorkspaceOwner) notFound(); // only the owner manages invitations; others see "not found"
  const invited = await listInvited(user);
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 sm:flex-row">
      <Sidebar current="people" showPeople />
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-8 sm:px-7">
        <div className="py-4">
          <h1 className="text-lg font-bold">People who can sign in</h1>
          <p className="mt-1 text-sm text-zinc-600">
            They get a sign-in link by email. Inviting someone does not add them to any team.
          </p>
        </div>
        <InvitePeople ownerEmail={user.email} invited={invited} />
      </main>
    </div>
  );
}
