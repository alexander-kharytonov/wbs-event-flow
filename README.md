# Event Flow

Next.js runs locally with `pnpm dev`. Docker Compose runs only PostgreSQL 18.

## Local setup

Use Node.js compatible with Prisma 7.10 (`^20.19 || ^22.12 || >=24.0`) and pnpm 11.23.0.
This setup was verified with Node.js 25.2.1.

```bash
pnpm install
cp .env.example .env
# Choose a local POSTGRES_PASSWORD in .env before the first database start.
pnpm db:up
pnpm db:generate
pnpm db:migrate
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
PostgreSQL 18 image layout. `db:down` preserves the volume.

| Command | Purpose |
| --- | --- |
| `pnpm db:up` | Start PostgreSQL and wait for its healthcheck |
| `pnpm db:down` | Stop/remove the container and network, retaining data |
| `pnpm db:status` | Show container status and health |
| `pnpm db:generate` | Generate Prisma Client into `generated/prisma` |
| `pnpm db:migrate` | Run local `prisma migrate dev` |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:check` | Verify a real PostgreSQL query through the application client |

## Prisma and environment

Prisma CLI, Client, and the official `@prisma/adapter-pg` adapter are pinned to
stable **7.10.0**. The adapter uses `pg`. The `prisma-client` generator has an
explicit output directory. `prisma.config.ts` defines the schema, migrations path,
and database URL; Prisma 7.10 supports this filename.

The schema intentionally has no models. `prisma migrate dev` currently reports
`Already in sync` without generating a migration. `prisma/migrations/.gitkeep`
retains the directory until the first real schema change. After adding an
explicitly approved model, run `pnpm db:migrate --name <change>` and then
`pnpm db:generate`. Prisma manages its temporary shadow database automatically.

`lib/env.ts` centrally validates the application's `DATABASE_URL` with Zod at
runtime, requiring a PostgreSQL URL with a host and database name. Invalid or
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
The current Biome 2.5.14 check reports missing SVG titles in the five existing
`public/*.svg` files, plus schema-version/deprecation notices for `biome.json`.
These scaffold issues are outside the database foundation scope.
