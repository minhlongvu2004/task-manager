import { lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { verificationTokens } from "@/db/schema";

/** Not user-scoped: called by the cron job. Deletes email sign-in tokens that expired before `now`. */
export async function purgeExpiredTokens(now: Date): Promise<number> {
  const db = await getDb();
  const rows = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expires, now))
    .returning({ token: verificationTokens.token });
  return rows.length;
}
