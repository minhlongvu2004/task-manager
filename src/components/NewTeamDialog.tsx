"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTeamAction } from "@/app/actions/teams";
import { Dialog, ErrorText, fieldClass, primaryBtn, quietBtn } from "./Dialog";

// A small fixed palette: no free-text colors reach the server.
export const TEAM_COLORS: { name: string; hex: string }[] = [
  { name: "Violet", hex: "#7c4dde" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Green", hex: "#16a34a" },
  { name: "Pink", hex: "#db2777" },
  { name: "Slate", hex: "#475569" },
];

export function NewTeamDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0].hex);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    start(async () => {
      const res = await createTeamAction({ name, color });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog title="New team" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="block text-sm font-medium">
          Team name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={fieldClass} />
        </label>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Color</legend>
          <div className="mt-1 flex gap-2">
            {TEAM_COLORS.map((c) => (
              <label key={c.hex} className="cursor-pointer">
                <input
                  type="radio"
                  name="team-color"
                  value={c.hex}
                  checked={color === c.hex}
                  onChange={() => setColor(c.hex)}
                  aria-label={c.name}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  style={{ background: c.hex }}
                  className="block h-7 w-7 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500"
                />
              </label>
            ))}
          </div>
        </fieldset>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={quietBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || pending} className={primaryBtn}>
            Create team
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewTeamButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? quietBtn}>
        + New team
      </button>
      {open && <NewTeamDialog onClose={() => setOpen(false)} />}
    </>
  );
}
