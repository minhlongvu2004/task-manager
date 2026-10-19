"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inviteAction, removeInviteAction } from "@/app/actions/people";
import { ErrorText, fieldClass, primaryBtn } from "./Dialog";

export function InvitePeople({ ownerEmail, invited: initial }: { ownerEmail: string; invited: string[] }) {
  const router = useRouter();
  const [invited, setInvited] = useState(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    start(async () => {
      const res = await inviteAction(email);
      if (res.ok) {
        setInvited((cur) => (cur.includes(res.email) || res.email === ownerEmail ? cur : [...cur, res.email].sort()));
        setEmail("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(address: string) {
    setError(null);
    start(async () => {
      const res = await removeInviteAction(address);
      if (res.ok) {
        setInvited((cur) => cur.filter((x) => x !== address));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <form onSubmit={invite} className="flex items-end gap-2">
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
          Invite
        </button>
      </form>
      {error && <ErrorText>{error}</ErrorText>}
      <ul className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
        <li className="flex items-center gap-2 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-zinc-600">{ownerEmail}</span>
          <span className="text-xs text-zinc-500">Owner</span>
        </li>
        {invited.map((address) => (
          <li key={address} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-zinc-600">{address}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(address)}
              aria-label={`Remove ${address}`}
              className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {invited.length === 0 && <p className="mt-3 text-sm text-zinc-500">No one else is invited yet.</p>}
    </div>
  );
}
