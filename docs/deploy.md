# Deploying to Railway

This is a step-by-step guide for the site owner. You do not need to be a developer. Everything happens in the Railway website and the Google Cloud website. Nothing here has been done for you: the code is ready, but the deploy itself is yours to run.

Before you start you need: the GitHub repository with this code **merged into `main`**, a Railway account (https://railway.com), and the Google OAuth client from [google-setup.md](google-setup.md).

## 1. Create the project

1. In Railway, click **New Project**, then **Deploy from GitHub repo**, and pick this repository.
2. When asked which branch to deploy, choose `main`.
3. Railway reads `railway.json` for the build and start commands, so you do not need to type them. The first deploy will fail until the steps below are done. That is normal.

## 2. Add the database

1. In the project, click **New** (or **Create**), then **Database**, then **Add PostgreSQL**.
2. A new Postgres service appears next to your app.

## 3. Set the variables

Open your app service, then the **Variables** tab, and add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Click "Add Reference" and choose the Postgres service's `DATABASE_URL`. Do not paste it by hand. |
| `AUTH_SECRET` | A long random string. Generate one with `npx auth secret` or `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` | From your Google OAuth client. |
| `AUTH_GOOGLE_SECRET` | From your Google OAuth client. |
| `OWNER_EMAIL` | Your Google account email. This account can always sign in. |
| `CRON_SECRET` | Another long random string. It protects the daily cleanup (step 6). |
| `AUTH_TRUST_HOST` | `true` |
| `APP_TIME_ZONE` | Optional. The time zone used to decide what "today" is for due-date colors, e.g. `America/Toronto`. Railway servers run in UTC, so set this to your own zone. If unset it defaults to `America/Toronto`. |

Why `AUTH_TRUST_HOST`: in the installed Auth.js source (`node_modules/@auth/core/lib/utils/env.js`), host trust defaults to on only when `AUTH_URL`, `AUTH_TRUST_HOST`, `VERCEL` or `CF_PAGES` is set, or when not in production. On Railway none of those exist, so without `AUTH_TRUST_HOST=true` sign-in fails with an "UntrustedHost" error. You do not need to set `AUTH_URL`: with trusted host, Auth.js builds the address from the request headers Railway's proxy sends.

If the app fails to start with "DATABASE_URL is not set", the reference in the first row is missing. This is deliberate: the app refuses to run without a database instead of quietly using a throwaway local one.

## 4. Get a public address

In the app service open **Settings**, then **Networking**, then **Generate Domain**. You get an address like `https://something.up.railway.app`. Keep it for the next step.

## 5. Tell Google about the new address

1. Open the Google Cloud console, go to **APIs & Services**, then **Credentials**, and open the OAuth client from [google-setup.md](google-setup.md).
2. Under **Authorized redirect URIs**, click **Add URI** and add
   `https://<your-railway-address>/api/auth/callback/google`
   (keep the existing `http://localhost:3000/...` one too).
3. Save. Google can take a few minutes to apply it.

Railway redeploys when you change variables. Wait until the deployment shows as active.

## 6. Daily cleanup of the trash (cron)

Deleted tasks are removed for good after 30 days. Something must call the cleanup once a day. The app has a protected route for that, `POST /api/cron/purge`, which only runs when the request carries `Authorization: Bearer <CRON_SECRET>`.

Railway cron (from Railway's docs at https://docs.railway.com/reference/cron-jobs, read 2026-10-18): a service with a Cron Schedule runs its start command on that schedule, must finish and exit, uses UTC, and runs must be at least 5 minutes apart. Set it up as a small second service:

1. In the same project click **New**, then **GitHub Repo**, and pick the same repository and branch again. This creates a second service.
2. Open its **Settings** and set **Config-as-code file path** (Railway's setting that points to a config file) to `/railway.cron.json`. This makes it run `node scripts/call-purge.mjs` instead of the web server, and skips the healthcheck.
3. In the same Settings page set **Cron Schedule** to `0 3 * * *` (03:00 UTC, every day).
4. In its **Variables** add `CRON_SECRET` (the same value as the web app; a reference to the app's variable works) and `APP_URL` (the public address from step 4, with `https://`).
5. To test right away, redeploy that service, or run `railway cron run` if you use the Railway CLI. The log should print `200 {"purged":0}`.

What I could not verify: the exact labels of the Settings fields in the Railway dashboard (the docs describe a "Cron Schedule" setting, but I did not see the dashboard), and whether the per-service config file path behaves as described. If that setting is missing, the fallback is any outside scheduler (for example GitHub Actions on a schedule) running:
`curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<address>/api/cron/purge`

## 7. Backups

What the docs say (https://docs.railway.com/reference/backups, read 2026-10-18): Railway volume backups cover Postgres. You turn them on in the database service's **Backups** tab. Schedules are daily (kept 6 days), weekly (kept 27 days) and monthly (kept 89 days). Backups are priced like volumes, and wiping the volume deletes its backups. Restores only go back into the same project.

What I could not determine: which plan tier includes them. The plans page (https://docs.railway.com/reference/pricing/plans, read 2026-10-18) does not mention backups. **Check the Backups tab on your Postgres service.** If you can turn on a daily schedule, do that and you are done. If it is unavailable on your plan, use the export below.

**Fallback: daily export.** `scripts/export-db.mjs` writes every table to one JSON file in `backups/` (ignored by git). It is read-only.

1. In the Postgres service open **Connect** and copy the **Public** connection URL (the internal one only works inside Railway).
2. On your computer, in the project folder, run, in PowerShell:
   `$env:DATABASE_URL="<public url>"; npm run db:export`
   or on Mac/Linux `DATABASE_URL="<public url>" npm run db:export`.
3. Keep the file somewhere private (it contains your users' emails and tasks). Run it daily with Windows Task Scheduler or cron, or at least weekly by hand.

This export is for rescue and inspection; it is a data dump, not a one-click restore. It was not run against a real Postgres while writing this.

## 8. Check it works (after the first successful deploy)

- [ ] `https://<address>/api/health` shows `{"ok":true}`.
- [ ] The site loads and redirects you to the sign-in page.
- [ ] Signing in with the `OWNER_EMAIL` Google account works.
- [ ] Signing in with a Google account that is not invited lands on the "not invited" page.
- [ ] Create a team, a project and a task.
- [ ] Trigger a redeploy (Deployments, then Redeploy), and confirm the team, project and task are still there.
- [ ] The cron route returns 401 without the secret (`curl -i -X POST https://<address>/api/cron/purge`) and 200 with `{"purged":0}` using the bearer token.

## How it starts (for the curious)

`npm start` first runs `scripts/migrate.mjs`, which applies the files in `drizzle/` to the database, then runs `next start`. Next listens on the `PORT` that Railway provides (checked in the installed Next source: `next start` reads the `PORT` environment variable and binds to all interfaces by default). The app's own code (`ensureMigrated()` in `src/db/client.ts`) reads the same `drizzle/` folder. If the migration fails, the deploy fails and the previous version keeps running.
