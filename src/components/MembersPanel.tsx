"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addMemberAction, deleteTeamAction, removeMemberAction } from "@/app/actions/teams";
import { Dialog, ErrorText, fieldClass, primaryBtn, quietBtn } from "./Dialog";

export type TeamMember = { id: string; email: string; name: string | null };

export function MembersPanel({
  teamId,
  teamName,
  members: initial,
  onClose,
}: {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    start(async () => {
      const res = await addMemberAction(teamId, email);
      if (res.ok) {
        setMembers((cur) => (cur.some((m) => m.id === res.member.id) ? cur : [...cur, res.member]));
        setEmail("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(m: TeamMember) {
    setError(null);
    start(async () => {
      const res = await removeMemberAction(teamId, m.id);
      if (res.ok) {
        setMembers((cur) => cur.filter((x) => x.id !== m.id));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function deleteTeam() {
    setError(null);
    start(async () => {
      const res = await deleteTeamAction(teamId);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog title={`Members of ${teamName}`} onClose={onClose}>
      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {m.name?.trim() ? <span className="mr-1.5 font-medium">{m.name}</span> : null}
              <span className="text-zinc-600">{m.email}</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(m)}
              aria-label={`Remove ${m.email}`}
              className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex items-end gap-2">
        <label className="block flex-1 text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={fieldClass}
          />
        </label>
        <button type="submit" disabled={!email.trim() || busy} className={primaryBtn}>
          Add
        </button>
      </form>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3">
        <button type="button" disabled={busy} onClick={deleteTeam} className={`${quietBtn} disabled:opacity-50`}>
          Delete team
        </button>
        <button type="button" onClick={onClose} className={quietBtn}>
          Done
        </button>
      </div>
    </Dialog>
  );
}

export function MembersButton({ teamId, teamName, members }: { teamId: string; teamName: string; members: TeamMember[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
      >
        Members
      </button>
      {open && <MembersPanel teamId={teamId} teamName={teamName} members={members} onClose={() => setOpen(false)} />}
    </>
  );
}
