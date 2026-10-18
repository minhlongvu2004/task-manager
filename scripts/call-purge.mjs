// Run by the Railway cron service: asks the web app to purge old trash, then exits.
// Needs APP_URL (e.g. https://your-app.up.railway.app) and CRON_SECRET in this service's variables.
const { APP_URL, CRON_SECRET } = process.env;
if (!APP_URL || !CRON_SECRET) {
  console.error("APP_URL and CRON_SECRET must both be set.");
  process.exit(1);
}
const res = await fetch(new URL("/api/cron/purge", APP_URL), {
  method: "POST",
  headers: { authorization: `Bearer ${CRON_SECRET}` },
  signal: AbortSignal.timeout(30000),
});
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
