// Railway healthcheck. Unauthenticated, does not touch the database, reveals nothing.
export function GET() {
  return Response.json({ ok: true });
}
