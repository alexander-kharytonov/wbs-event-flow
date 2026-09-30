# Attendee cutover (21A)

This release requires a maintenance window. Stop application writers, old readers,
Next servers and email dispatchers; prevent other clients/jobs from reconnecting.
Retain a normal secure database backup and the unchanged encryption key. Do not
resume any consumer between the steps below. Run from the release checkout with
its normal environment; commands never print credentials or envelopes.

1. Confirm all previous migrations and the №19 Ticket backfill have completed.
   Every Registration must already have exactly one valid Ticket. Missing or
   inconsistent history is an error; do not regenerate secrets to repair it.
2. Apply only the preparation migration, then record its successful application:

   ```sh
   pnpm exec prisma db execute --file prisma/migrations/20260930000000_attendee_prepare/migration.sql
   pnpm exec prisma migrate resolve --applied 20260930000000_attendee_prepare
   ```

3. Run the canonical Node data/crypto migration:

   ```sh
   pnpm db:migrate-attendees
   ```

   One transaction locks User/Event/Application/Registration/Attendee/Ticket/Attendance.
   It preflights Application/admission history, identity/timestamps, Ticket cardinality,
   Attendance provenance, capability pairs, envelope authentication and hashes.
   It creates PRIMARY using UUIDv7, copies exact identity/lifecycle timestamps, maps
   Ticket/Attendance and encrypts the **same** secrets with new random IVs and AAD
   `eventflow:ticket:v1:<Attendee.id>:credential` / `:access`. It verifies unchanged
   Ticket IDs/numbers/hashes/timestamps, exact raw secrets, all Attendance historical
   fields, zero GUEST and active Registration/PRIMARY capacity equality per Event.
   It emits no outbox records or notifications.
4. Switch to the matching runtime release while consumers remain stopped, then:

   ```sh
   pnpm exec prisma migrate deploy
   pnpm db:generate
   pnpm db:migrate-attendees
   pnpm db:check
   pnpm exec prisma migrate status
   pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   ```

   Finalization guards complete mappings, makes attendeeId required and removes
   only obsolete Ticket/Attendance Registration relations. The second Node run
   verifies new AAD and reports an already-migrated no-op, also after finalization.
5. Build/verify the new release before restarting application and dispatcher.

Do not run ordinary `migrate deploy` across preparation and finalization on a
populated №20 database: finalization deliberately rejects missing Node backfill.
For an empty new database both SQL migrations can apply; there are no secrets to
rebind. Normal runtime writers then create Registration + PRIMARY + Ticket.

A Node failure rolls back its entire transaction, including PRIMARY IDs/mappings
and envelope changes; preparation remains applied. Its error identifies the phase
without printing sensitive arguments. Investigate before retrying. Any mixed AAD,
partial mapping, hash failure or inconsistent history fails loudly. There is no
runtime old-AAD fallback and no conflict-skipping repair. Successful reruns verify
existing mappings/secrets without rotating them. If preparation committed but its
Prisma resolve step failed, verify the applied SQL before recording it; do not
blindly reapply CREATE statements. Never restart old consumers after rebind, and
never roll back only the runtime release against the migrated database.
