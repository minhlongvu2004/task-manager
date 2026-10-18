import { db } from "@/db/client";
import { allowedEmails } from "@/db/schema";
import { ensureUserOnSignIn } from "@/server/access";
import { resetDb } from "../db/helpers";

export async function setup() {
  await resetDb();
  process.env.OWNER_EMAIL = "owner@example.com";
  const owner = (await ensureUserOnSignIn("owner@example.com", "Owner"))!;
  const mk = async (email: string) => {
    await db.insert(allowedEmails).values({ email });
    return (await ensureUserOnSignIn(email, email))!;
  };
  const alice = await mk("alice@example.com");
  const bob = await mk("bob@example.com");
  return { owner, alice, bob };
}
