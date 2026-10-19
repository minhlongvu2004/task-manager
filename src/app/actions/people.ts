"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/server/access";
import { BlockedError, NotFoundError } from "@/server/errors";
import { inviteEmail, removeInvite } from "@/server/people";

export type PeopleResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

// The acting user always comes from the session; only the owner passes the checks in server/people.
async function run<T extends object>(fn: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<T | void>): Promise<PeopleResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in" };
  let extra: T | void;
  try {
    extra = await fn(user);
  } catch (e) {
    if (e instanceof NotFoundError) return { ok: false, error: "Not found" };
    if (e instanceof BlockedError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/people");
  return { ok: true, ...(extra ?? {}) } as PeopleResult<T>;
}

export async function inviteAction(email: unknown): Promise<PeopleResult<{ email: string }>> {
  return run(async (user) => {
    if (typeof email !== "string") throw new BlockedError("Email must be text");
    return { email: await inviteEmail(user, email) };
  });
}

export async function removeInviteAction(email: unknown): Promise<PeopleResult> {
  return run(async (user) => {
    if (typeof email !== "string") throw new BlockedError("Email must be text");
    await removeInvite(user, email);
  });
}
