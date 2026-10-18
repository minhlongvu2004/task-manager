import { beforeEach, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedEmails, users, workspaces } from "@/db/schema";
import { resetDb } from "../db/helpers";
import { ensureUserOnSignIn, isEmailAllowed } from "@/server/access";

beforeEach(async () => {
  await resetDb();
  process.env.OWNER_EMAIL = "Owner@Example.com";
});

const n = async (t: typeof users | typeof workspaces) => (await db.select({ c: count() }).from(t))[0].c;

describe("isEmailAllowed", () => {
  it("is case-insensitive for the owner and the allowlist", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    expect(await isEmailAllowed("OWNER@example.com")).toBe(true);
    expect(await isEmailAllowed("  Friend@Example.COM ")).toBe(true);
    expect(await isEmailAllowed("stranger@example.com")).toBe(false);
  });

  it("is false for everyone when OWNER_EMAIL is unset and the list is empty", async () => {
    delete process.env.OWNER_EMAIL;
    expect(await isEmailAllowed("")).toBe(false);
    expect(await isEmailAllowed("a@b.com")).toBe(false);
  });
});

describe("ensureUserOnSignIn", () => {
  it("returns null and creates nothing for a non-allowed email", async () => {
    expect(await ensureUserOnSignIn("stranger@example.com", "S")).toBeNull();
    expect(await n(users)).toBe(0);
    expect(await n(workspaces)).toBe(0);
  });

  it("creates one user and one workspace on the owner's first sign-in, none on the second", async () => {
    const first = await ensureUserOnSignIn("OWNER@example.com", "Olivia");
    expect(first).toMatchObject({ email: "owner@example.com", isWorkspaceOwner: true });
    const second = await ensureUserOnSignIn("owner@example.com", "Olivia");
    expect(second?.id).toBe(first?.id);
    expect(await n(users)).toBe(1);
    expect(await n(workspaces)).toBe(1);
    const [ws] = await db.select().from(workspaces);
    expect(ws.ownerUserId).toBe(first?.id);
  });

  it("is safe under concurrent calls", async () => {
    const results = await Promise.all([
      ensureUserOnSignIn("owner@example.com", "O"),
      ensureUserOnSignIn("owner@example.com", "O"),
      ensureUserOnSignIn("owner@example.com", "O"),
    ]);
    expect(new Set(results.map((r) => r?.id)).size).toBe(1);
    expect(await n(users)).toBe(1);
    expect(await n(workspaces)).toBe(1);
  });

  it("reuses a pre-existing user row and fills in the name; member is not workspace owner", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const [pre] = await db.insert(users).values({ email: "friend@example.com" }).returning();
    const u = await ensureUserOnSignIn("Friend@example.com", "Frank");
    expect(u).toEqual({ id: pre.id, email: "friend@example.com", isWorkspaceOwner: false });
    expect(await n(users)).toBe(1);
    expect(await n(workspaces)).toBe(0);
    const [row] = await db.select().from(users);
    expect(row.name).toBe("Frank");
  });
});
