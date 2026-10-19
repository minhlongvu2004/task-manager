import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { teamMembers, teams } from "@/db/schema";
import { resetDb } from "../db/helpers";
import { assertCanSeeTeam, ensureUserOnSignIn, visibleTeamIds, type SessionUser } from "@/server/access";
import { NotFoundError } from "@/server/errors";
import { allowedEmails, users } from "@/db/schema";

let owner: SessionUser;
let member: SessionUser;
let t1: string;
let t2: string;

beforeEach(async () => {
  await resetDb();
  process.env.OWNER_EMAIL = "owner@example.com";
  owner = (await ensureUserOnSignIn("owner@example.com", "O"))!;
  await db.insert(allowedEmails).values({ email: "m@example.com" });
  member = (await ensureUserOnSignIn("m@example.com", "M"))!;
  const wsId = (await db.query.workspaces.findFirst())!.id;
  [{ id: t1 }, { id: t2 }] = await db
    .insert(teams)
    .values([
      { workspaceId: wsId, name: "A" },
      { workspaceId: wsId, name: "B" },
    ])
    .returning({ id: teams.id });
  await db.insert(teamMembers).values({ teamId: t1, userId: member.id });
});

describe("visibleTeamIds", () => {
  it("returns only the teams the owner has joined, like everyone else", async () => {
    expect(await visibleTeamIds(owner)).toEqual([]);
    await db.insert(teamMembers).values({ teamId: t2, userId: owner.id });
    expect(await visibleTeamIds(owner)).toEqual([t2]);
  });
  it("returns only joined teams for a member", async () => {
    expect(await visibleTeamIds(member)).toEqual([t1]);
  });
  it("returns [] for a user with no teams", async () => {
    const [u] = await db.insert(users).values({ email: "x@example.com" }).returning();
    expect(await visibleTeamIds({ id: u.id, email: u.email, isWorkspaceOwner: false })).toEqual([]);
  });
});

describe("assertCanSeeTeam", () => {
  it("passes for a member of the team", async () => {
    await expect(assertCanSeeTeam(member, t1)).resolves.toBeUndefined();
  });
  it("throws NotFoundError for a non-member, the owner included", async () => {
    await expect(assertCanSeeTeam(member, t2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(assertCanSeeTeam(owner, t1)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getSessionUser", () => {
  it("returns null once the email is removed from the allowlist; the owner still resolves", async () => {
    const { vi } = await import("vitest");
    const { eq } = await import("drizzle-orm");
    let email: string | undefined = "m@example.com";
    vi.doMock("@/auth", () => ({ auth: async () => (email ? { user: { email } } : null) }));
    const { getSessionUser } = await import("@/server/access");
    expect((await getSessionUser())?.id).toBe(member.id);
    await db.delete(allowedEmails).where(eq(allowedEmails.email, "m@example.com"));
    expect(await getSessionUser()).toBeNull();
    email = "owner@example.com";
    expect((await getSessionUser())?.id).toBe(owner.id);
    vi.doUnmock("@/auth");
  });
});
