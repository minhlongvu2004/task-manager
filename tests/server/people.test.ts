import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedEmails, users } from "@/db/schema";
import { isEmailAllowed, type SessionUser } from "@/server/access";
import { BlockedError } from "@/server/errors";
import { inviteEmail, listInvited, removeInvite } from "@/server/people";
import { setup } from "./fixtures";

let owner: SessionUser, alice: SessionUser;
beforeEach(async () => {
  ({ owner, alice } = await setup());
});

describe("people (the invited list)", () => {
  it("lists invited emails alphabetically, without the owner", async () => {
    expect(await listInvited(owner)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("the owner can invite: the email is cleaned up, allowed to sign in, and not on any team", async () => {
    expect(await inviteEmail(owner, "  Carol@Example.COM ")).toBe("carol@example.com");
    expect(await isEmailAllowed("carol@example.com")).toBe(true);
    expect(await listInvited(owner)).toContain("carol@example.com");
  });

  it("inviting twice is harmless", async () => {
    await inviteEmail(owner, "carol@example.com");
    await inviteEmail(owner, "CAROL@example.com");
    expect(await db.select().from(allowedEmails).where(eq(allowedEmails.email, "carol@example.com"))).toHaveLength(1);
  });

  it("inviting the owner's own address changes nothing", async () => {
    await inviteEmail(owner, "OWNER@example.com");
    expect(await db.select().from(allowedEmails).where(eq(allowedEmails.email, "owner@example.com"))).toHaveLength(0);
  });

  it("rejects bad emails", async () => {
    for (const bad of ["", "nope", "a@b", "two words@x.com"]) {
      await expect(inviteEmail(owner, bad)).rejects.toBeInstanceOf(BlockedError);
    }
  });

  it("removing someone stops them signing in but keeps their account and history", async () => {
    await removeInvite(owner, "Alice@Example.com");
    expect(await isEmailAllowed("alice@example.com")).toBe(false);
    expect(await listInvited(owner)).toEqual(["bob@example.com"]);
    expect(await db.select().from(users).where(eq(users.email, "alice@example.com"))).toHaveLength(1);
    await removeInvite(owner, "nobody@example.com"); // unknown address: no error
  });

  it("only the owner can see or change the list", async () => {
    await expect(listInvited(alice)).rejects.toThrow("Only the owner");
    await expect(inviteEmail(alice, "carol@example.com")).rejects.toThrow("Only the owner");
    await expect(removeInvite(alice, "bob@example.com")).rejects.toThrow("Only the owner");
    expect(await isEmailAllowed("carol@example.com")).toBe(false);
    expect(await isEmailAllowed("bob@example.com")).toBe(true);
  });
});
