# Task Manager

A simple, fast task manager: teams, projects, tasks. See [docs/design.md](docs/design.md) for the design.

Status: scaffolded (Next.js 16, TypeScript, Tailwind, Drizzle, Auth.js v5, Vitest).

## Setup

Requires Node 24 and npm 11. No Docker needed.

1. `npm install`
2. `cp .env.example .env.local` and fill in the values:
   - `DATABASE_URL`: only set in production. When unset, the app uses a local PGlite database in `.data/`.
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: Auth.js with Google sign-in.
   - `OWNER_EMAIL`: the owner account's email.
3. `npm run dev` serves on http://localhost:3000
4. `npm test` runs Vitest.

## Testing

Vitest 5 with two projects (see `vitest.config.ts`): tests in `tests/**/*.test.ts` run in the `node` environment; tests in `tests/components/` run in `jsdom` with React Testing Library and jest-dom (set up in `tests/setup-components.ts`). The `@/` alias maps to `src/`.

Scripts: `npm run db:generate` and `npm run db:migrate` (drizzle-kit).
