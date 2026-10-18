import { createHash, timingSafeEqual } from "node:crypto";

/** True only when CRON_SECRET is set and non-empty and the request carries `Authorization: Bearer <it>`. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // unset or empty: never authorized
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const given = header.slice("Bearer ".length);
  // Hash both sides so the buffers are equal length and the comparison is constant time.
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(given), h(secret));
}
