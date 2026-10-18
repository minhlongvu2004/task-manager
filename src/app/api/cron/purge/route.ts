import { isCronAuthorized } from "@/server/cron-auth";
import { purgeTrash } from "@/server/tasks";
import { purgeExpiredTokens } from "@/server/tokens";

// POST handlers are never cached or prerendered, so no `dynamic` config is needed (and the
// `dynamic` segment option is not allowed with cacheComponents).
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const purged = await purgeTrash(now);
  const tokensPurged = await purgeExpiredTokens(now);
  return Response.json({ purged, tokensPurged });
}
