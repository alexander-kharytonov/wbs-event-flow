FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Build-only nonsecret values; runtime secrets are supplied by Railway.
RUN NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_URL=https://build.invalid \
    BETTER_AUTH_SECRET=build-only-not-a-runtime-secret-000000 \
    TICKET_CREDENTIAL_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA \
    SMTP_FROM=build@example.invalid \
    pnpm build

FROM node:24.21.0-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu acl openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.23.0
COPY --from=build --chown=node:node /app /app
ENV NODE_ENV=production
ENV MEDIA_STORAGE_ROOT=/data/media
ENV NEXT_TELEMETRY_DISABLED=1
# Start as root only to validate/provision the volume, then drop to uid 1000.
CMD ["sh", "scripts/railway-entrypoint.sh"]
