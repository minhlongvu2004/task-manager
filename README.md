# Task Manager

A simple, fast task manager: teams, projects, tasks. See [docs/design.md](docs/design.md) for the design.

Status: version 1 is built (teams, projects, tasks, trash with 30-day purge, Google and optional email-link sign-in) and ready for the Railway deploy. Stack: Next.js 16, TypeScript, Tailwind, Drizzle, Auth.js v5, Vitest.

## Setup

Requires Node 24 and npm 11. No Docker needed.

1. `npm install`
2. `cp .env.example .env.local` and fill in the values:
   - `DATABASE_URL`: only set in production. When unset, the app uses a local PGlite database in `.data/`.
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: Auth.js with Google sign-in.
   - `OWNER_EMAIL`: the owner account's email.
   - `APP_TIME_ZONE` (optional): time zone for "today" in due-date colors. Defaults to `America/Toronto`.
   - See [docs/google-setup.md](docs/google-setup.md) for the step-by-step Google setup.
3. `npm run dev` serves on http://localhost:3000
4. `npm test` runs Vitest.

## Testing

Vitest 5 with two projects (see `vitest.config.mts`): tests in `tests/**/*.test.ts` run in the `node` environment; tests in `tests/components/` run in `jsdom` with React Testing Library and jest-dom (set up in `tests/setup-components.ts`). The `@/` alias maps to `src/`.

Scripts: `npm run db:generate` and `npm run db:migrate` (drizzle-kit).

## Deploy

Hosted on Railway with PostgreSQL. Step-by-step instructions, the post-deploy checklist, the daily purge cron and backups are in [docs/deploy.md](docs/deploy.md).

Production env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`, `CRON_SECRET`, `AUTH_TRUST_HOST=true`. Optional: `APP_TIME_ZONE` (defaults to `America/Toronto`; Railway runs in UTC, so set your own zone). Optional, for email sign-in links (see docs/resend-setup.md): `AUTH_RESEND_KEY`, `EMAIL_FROM`.

## Owner notes

- Inviting and revoking: the owner uses the **People** page in the sidebar. Removing someone stops them signing in at once (`getSessionUser` re-checks the list on every request) but keeps their account, team memberships and tasks. Being invited gives no access to any team: teams are private, and the owner sees only the teams they belong to. The team **Members** popup only accepts people already on the People list.
- Changing `OWNER_EMAIL` later does not move workspace ownership: the existing owner keeps it.
