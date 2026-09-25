# Event Flow

Next.js runs locally with `pnpm dev`. Docker Compose runs PostgreSQL 18 and Mailpit.

## Local setup

Use Node.js compatible with Prisma 7.10 (`^20.19 || ^22.12 || >=24.0`) and pnpm 11.23.0.
This setup was verified with Node.js 25.2.1.

```bash
pnpm install
cp .env.example .env
# Choose a local POSTGRES_PASSWORD before the first database start.
# Set BETTER_AUTH_SECRET in .env using: openssl rand -base64 32
pnpm infra:up
pnpm db:migrate
pnpm db:generate
pnpm db:check
pnpm dev
```

Open http://localhost:3000. If `.env` already exists, retain it instead of copying
again. `.env` and generated Prisma Client files are gitignored; `.env.example`
contains only safe example values. No client environment variables are needed.

Database settings are defined in `.env`:

- `POSTGRES_USER`: local PostgreSQL user.
- `POSTGRES_PASSWORD`: local Docker PostgreSQL password.
- `POSTGRES_DB`: development database name.
- `POSTGRES_HOST`: host interface used by Compose and the application (`127.0.0.1`).
- `POSTGRES_PORT`: published host port (`5432`); the container uses port 5432 internally.
- `DATABASE_URL`: connection URL expanded from the settings above.

Use a URL-safe password (for example a random hexadecimal string). If credentials
contain special characters, percent-encode them in connection URLs. Changing the
user, password, or database name in `.env` does not update an already initialized
volume; these PostgreSQL image settings apply only on first initialization.
Compose reads `.env`; keep database credentials there so they match the application.

## Database infrastructure

By default, PostgreSQL contains the `event_flow_dev` database and listens only on
`127.0.0.1:5432`, accessible to the local Next.js process. The configured host port
must be free.

The named `postgres_data` volume is mounted at `/var/lib/postgresql`, matching the
PostgreSQL 18 image layout. `infra:down` preserves the volume.

| Command             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `pnpm infra:up`     | Start PostgreSQL + Mailpit and wait for their healthchecks    |
| `pnpm infra:down`   | Stop/remove containers and network, retaining PostgreSQL data |
| `pnpm infra:status` | Show container status and health                              |
| `pnpm db:generate`  | Generate Prisma Client into `generated/prisma`                |
| `pnpm db:migrate`   | Run local `prisma migrate dev`                                |
| `pnpm db:studio`    | Open Prisma Studio                                            |
| `pnpm db:check`     | Verify a real PostgreSQL query through the application client |

## Prisma and environment

Prisma CLI, Client, and the official `@prisma/adapter-pg` adapter are pinned to
stable **7.10.0**. The adapter uses `pg`. The `prisma-client` generator has an
explicit output directory. `prisma.config.ts` defines the schema, migrations path,
and database URL; Prisma 7.10 supports this filename.

The standard Better Auth `User`, `Session`, `Account`, and `Verification` models
were generated with the official `auth@1.7.6 generate` CLI from `lib/auth.ts`.
Prisma owns migration `20260925093648_authentication_foundation`. Apply it locally
with `pnpm db:migrate`, then run `pnpm db:generate`.

The auth CLI requires temporarily removing `server-only` imports from auth and
its server dependencies; restore them after generation. Load environment using
`@next/env` before invoking the CLI so `${...}` references in `DATABASE_URL` expand.
No separate Prisma Client is needed.

`lib/env.ts` centrally validates the database, authentication, and SMTP settings
with Zod at runtime. Invalid or
missing configuration fails without printing credentials. The Docker password
is not read by application code. Prisma CLI and the local
check load environment files through `@next/env` using development precedence;
Next.js loads them itself.

`lib/prisma.ts` is the single server-only Prisma Client entry point. It caches the
client on `globalThis` during development, reusing the client and adapter pool
across hot reloads. Import this module only from Node.js server code.

`scripts/db-check.ts` loads the same environment layer and imports that same
client. It runs a read-only query for the current database, PostgreSQL version,
and `1`, then disconnects. The script's `react-server` condition permits the
`server-only` import in this standalone Node.js process. No route or product UI
is added. This command can be removed when a real database-backed feature
provides the needed verification.

## Static checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

The existing scaffold uses Google Fonts, so its build needs network access.
Unused scaffold SVGs and CSS have been removed; the full lint baseline is clean.

## Local authentication

- `BETTER_AUTH_URL`: application origin, initially `http://localhost:3000`, without
  a trailing slash. Use this same origin in the browser. Better Auth trusts its
  configured base origin; no additional trusted origins are needed locally.
- `BETTER_AUTH_SECRET`: high-entropy secret of at least 32 characters; generate
  with `openssl rand -base64 32` and keep it in the ignored `.env`.
- `SMTP_HOST`: `127.0.0.1` for local Mailpit (also its Compose bind address).
- `SMTP_PORT`: `1025` for SMTP (also its published Compose port).
- `SMTP_FROM`: sender address, e.g. `no-reply@event-flow.local`.

`pnpm infra:up` starts both services.
Open Mailpit at http://localhost:8025. SMTP and inbox ports bind only to loopback
with the example settings. Mailpit captures local email and does not deliver it
externally; its inbox is ephemeral when the container is removed.

Open `/register`, enter name, email and a 10–128 character password, then follow
the link delivered to Mailpit. Links expire after 3600 seconds. Verification
creates a database session and redirects to `/onboarding/organizer`, which ensures
one `OrganizerProfile` and redirects to `/dashboard`. The Better Auth user remains
a neutral authentication identity, without a role discriminator.

`/sign-in` rejects unverified accounts and sends a fresh verification email when
valid credentials are supplied. Successful sign-in opens `/dashboard`; an existing
organizer keeps the same profile. **Sign out** is available in the shared header.
Sessions last 604800 seconds and refresh after 86400 seconds through Better Auth's
endpoints; cookie session caching is disabled. Server routes validate sessions
against the database.

`lib/mail.ts` sends text and minimal HTML via Nodemailer SMTP. Sending is awaited
and SMTP failure is propagated as an error. A Better Auth before hook makes
email tasks propagate errors for the three email entry endpoints; version 1.7.6
otherwise catches these failures internally. After a failed registration delivery,
try signing in to request a new link. Waiting for SMTP preserves honest delivery
results but does not equalize duplicate/new registration response timing.
Auth request URLs are excluded from Next.js development request logs because
verification links contain tokens.

## UI and color modes

Material UI 9.4 provides the UI foundation, using the official
`@mui/material-nextjs/v16-appRouter` cache provider for streamed SSR styles.
The shared header offers **System**, **Light**, and **Dark** via MUI's
`useColorScheme`. MUI stores the selection in browser localStorage (`mui-mode`);
System follows changes to `prefers-color-scheme`.

The centralized theme uses `colorSchemes` and CSS variables with a `data` selector.
`InitColorSchemeScript` is the first body child and selects the scheme before
hydration, preventing the initial wrong-theme flash without hiding content.
Its `defaultMode="system"` matches the ThemeProvider. `CssBaseline` supplies global
styles; no client effect computes the initial theme.

## Organizer foundation

`OrganizerProfile` is an Event Flow domain model, separate from Better Auth:
`id`, unique `userId` (one-to-one with User), `createdAt`, and `updatedAt`.
The `organizer_profile_foundation` migration adds only this table and relation.

`/onboarding/organizer` is a server transition, with no form. It requires a
current database-backed session and verified email, then inserts a profile with
`skipDuplicates` backed by PostgreSQL's unique constraint. Repeat and concurrent
requests preserve the existing profile and its timestamps.

`/dashboard` independently validates the session and verified email, then reads
the profile. Missing sessions redirect to `/sign-in`; unverified users return to
sign-in with verification guidance. A verified user without a profile redirects
to onboarding. The dashboard never creates profiles and lists only events owned
by the current OrganizerProfile, with a Create event action and an empty state.

## Create Event

`features/events/` contains the MUI form, Zod validation, Server Action, and local
time formatter. `/dashboard/events/new` creates a draft and redirects to the
read-only `/dashboard/events/[id]`. Both pages and the action use the same
verified-session/organizer guard as the dashboard. Detail lookup includes the
current organizer ID; missing and foreign events both use Next.js not-found.

Apply `20260925111851_create_event_foundation` with `pnpm db:migrate`, then run
`pnpm db:generate`. Restart an already running `pnpm dev` after regenerating the
client: hot reload retains the cached Prisma instance, which does not acquire
new model delegates. Event instants use PostgreSQL `timestamptz(3)` and retain a
separate IANA timezone. The server converts local input with
`@js-temporal/polyfill`, rejecting both nonexistent and ambiguous DST times.
The browser supplies a searchable standard timezone list and an initial value;
the server independently validates the zone. Display always uses the event zone.

Creation sets `publishedAt = null`; visibility defaults to PRIVATE and account
requirement to OPTIONAL. Registration dates are configuration only. Editing,
publication, guest registration, teams, RBAC, subscriptions, password reset,
external mail providers, tests, CI/CD, and deployment are not included.
