import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";
import {
  communicationContextSchema,
  deliveryAssociationSchema,
} from "@/features/communications/server/contracts";
import {
  applicationAnswersSchema,
  applicationInputSchema,
} from "@/features/events/application-input";
import { mediaManifestSchema } from "@/features/events/schemas/event-rich-content";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import type { Prisma } from "@/generated/prisma/client";
import {
  emailPayloadSchemas,
  manualEmailPayload,
} from "@/lib/email-outbox/payload";

async function checkMigrationHistory(tx: Prisma.TransactionClient) {
  const directories = await readdir("prisma/migrations", {
    withFileTypes: true,
  });
  const expected = new Map(
    await Promise.all(
      directories
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const sql = await readFile(
            `prisma/migrations/${entry.name}/migration.sql`,
          );

          return [
            entry.name,
            createHash("sha256").update(sql).digest("hex"),
          ] as const;
        }),
    ),
  );
  const [{ exists }] = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS exists
  `;

  if (!exists) {
    return [{ invariant: "migration_history_missing", invalid_count: 1 }];
  }

  const applied = await tx.$queryRaw<
    { migration_name: string; checksum: string; finished: boolean }[]
  >`
    SELECT migration_name, checksum, finished_at IS NOT NULL AS finished
    FROM "_prisma_migrations" WHERE rolled_back_at IS NULL
  `;
  const completed = new Set(
    applied.filter((row) => row.finished).map((row) => row.migration_name),
  );

  return [
    {
      invariant: "migration_pending",
      invalid_count: [...expected.keys()].filter((name) => !completed.has(name))
        .length,
    },
    {
      invariant: "migration_failed",
      invalid_count: applied.filter((row) => !row.finished).length,
    },
    {
      invariant: "migration_unexpected",
      invalid_count: applied.filter((row) => !expected.has(row.migration_name))
        .length,
    },
    {
      invariant: "migration_checksum_mismatch",
      invalid_count: applied.filter(
        (row) =>
          expected.has(row.migration_name) &&
          expected.get(row.migration_name) !== row.checksum,
      ).length,
    },
    {
      invariant: "migration_duplicate",
      invalid_count:
        applied.length - new Set(applied.map((row) => row.migration_name)).size,
    },
  ].filter((violation) => violation.invalid_count > 0);
}

async function checkSchemaAlignment() {
  try {
    // Comparing a live datasource to a datamodel only introspects the database.
    // No shadow database, migration application or schema/data writes are requested.
    // Capture all CLI output: even failures must not expose connection details.
    await promisify(execFile)(
      process.execPath,
      [
        resolve("node_modules/prisma/build/index.js"),
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
    );

    return null;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === 2
      ? "schema_alignment_drift"
      : "schema_alignment_unavailable";
  }
}

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { prisma } = await import("@/lib/prisma");

  try {
    const migrationFailures = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;

        return checkMigrationHistory(tx);
      },
      { isolationLevel: "RepeatableRead", timeout: 10_000 },
    );

    if (migrationFailures.length > 0) {
      for (const failure of migrationFailures) {
        console.error(
          `Database preflight failed: ${failure.invariant}; count=${failure.invalid_count}`,
        );
      }
      process.exitCode = 1;

      return;
    }

    const schemaFailure = await checkSchemaAlignment();

    if (schemaFailure) {
      console.error(`Database preflight failed: ${schemaFailure}; count=1`);
      process.exitCode = 1;

      return;
    }

    console.log(
      "Database migration history and Prisma schema alignment passed.",
    );
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const connection = await tx.$queryRaw<
          { database: string; version: string; ok: number }[]
        >`SELECT current_database() AS database, version() AS version, 1 AS ok`;
        const counts = await tx.$queryRaw<{ entity: string; total: bigint }[]>`
          SELECT 'User' AS entity, count(*) AS total FROM "user"
          UNION ALL SELECT 'Session', count(*) FROM "session"
          UNION ALL SELECT 'Account', count(*) FROM "account"
          UNION ALL SELECT 'Verification', count(*) FROM "verification"
          UNION ALL SELECT 'OrganizerProfile', count(*) FROM "OrganizerProfile"
          UNION ALL SELECT 'Event', count(*) FROM "Event"
          UNION ALL SELECT 'EventRevision', count(*) FROM "EventRevision"
          UNION ALL SELECT 'MediaAsset', count(*) FROM "MediaAsset"
          UNION ALL SELECT 'EventCreationReceipt', count(*) FROM "EventCreationReceipt"
          UNION ALL SELECT 'EventStaff', count(*) FROM "EventStaff"
          UNION ALL SELECT 'RegistrationForm', count(*) FROM "RegistrationForm"
          UNION ALL SELECT 'RegistrationField', count(*) FROM "RegistrationField"
          UNION ALL SELECT 'RegistrationFieldOption', count(*) FROM "RegistrationFieldOption"
          UNION ALL SELECT 'Application', count(*) FROM "Application"
          UNION ALL SELECT 'ApplicationGuest', count(*) FROM "ApplicationGuest"
          UNION ALL SELECT 'ApplicationGuestAnswer', count(*) FROM "ApplicationGuestAnswer"
          UNION ALL SELECT 'ApplicationGuestAnswerOption', count(*) FROM "ApplicationGuestAnswerOption"
          UNION ALL SELECT 'ApplicationAnswer', count(*) FROM "ApplicationAnswer"
          UNION ALL SELECT 'ApplicationAnswerOption', count(*) FROM "ApplicationAnswerOption"
          UNION ALL SELECT 'Registration', count(*) FROM "Registration"
          UNION ALL SELECT 'Attendee', count(*) FROM "Attendee"
          UNION ALL SELECT 'Ticket', count(*) FROM "Ticket"
          UNION ALL SELECT 'Attendance', count(*) FROM "Attendance"
          UNION ALL SELECT 'Communication', count(*) FROM "Communication"
          UNION ALL SELECT 'EmailOutbox', count(*) FROM "EmailOutbox"
          ORDER BY entity
        `;
        // One consistent snapshot. SQL returns counts, never identities/secrets.
        const violations = await tx.$queryRaw<
          { invariant: string; invalid_count: bigint }[]
        >`
          WITH primary_counts AS (
            SELECT "registrationId", count(*) AS total
            FROM "Attendee" WHERE kind = 'PRIMARY'
            GROUP BY "registrationId"
          ), ticket_counts AS (
            SELECT "attendeeId", count(*) AS total
            FROM "Ticket" GROUP BY "attendeeId"
          ), active_registrations AS (
            SELECT "eventId", count(*) AS total
            FROM "Registration" WHERE "revokedAt" IS NULL
            GROUP BY "eventId"
          ), active_primaries AS (
            SELECT r."eventId", count(*) AS total
            FROM "Attendee" a
            JOIN "Registration" r ON r.id = a."registrationId"
            WHERE a.kind = 'PRIMARY' AND a."revokedAt" IS NULL
            GROUP BY r."eventId"
          ), delivery_counts AS (
            SELECT "communicationId", count(*) AS total
            FROM "EmailOutbox"
            GROUP BY "communicationId"
          ), checks AS (
            SELECT 'event_password_access' AS invariant, count(*) AS invalid_count
            FROM "Event" e
            WHERE (e."draftPasswordHash" IS NOT NULL AND (e.visibility <> 'PRIVATE' OR e."draftPasswordHash" !~ '^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$'))
              OR e."passwordFailures" NOT BETWEEN 0 AND 100
              OR (e."passwordFailures" > 0 AND e."passwordFailureWindow" IS NULL)
            UNION ALL
            SELECT 'revision_password_access', count(*)
            FROM "EventRevision" r
            WHERE (r."passwordHash" IS NULL) <> (r."passwordGrantId" IS NULL)
              OR (r."passwordHash" IS NOT NULL AND (r."snapshot"->>'visibility' IS DISTINCT FROM 'PRIVATE' OR r."passwordHash" !~ '^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$'))
            UNION ALL
            SELECT 'application_lifecycle_timestamps' AS invariant,
              count(*) AS invalid_count
            FROM "Application" a
            WHERE (a.status = 'PENDING' AND (a."reviewedAt" IS NOT NULL OR a."withdrawnAt" IS NOT NULL))
              OR (a.status IN ('APPROVED', 'REJECTED') AND (a."reviewedAt" IS NULL OR a."withdrawnAt" IS NOT NULL))
              OR (a.status = 'WITHDRAWN' AND a."withdrawnAt" IS NULL)
              OR a."reviewedAt" < a."createdAt"
              OR a."withdrawnAt" < a."createdAt"
              OR a."withdrawnAt" < a."reviewedAt"
            UNION ALL
            SELECT 'application_registration_correspondence', count(*)
            FROM "Application" a
            FULL JOIN "Registration" r ON r."sourceApplicationId" = a.id
            WHERE CASE
              WHEN a.status = 'APPROVED' OR (a.status = 'WITHDRAWN' AND a."reviewedAt" IS NOT NULL)
              THEN r.id IS NULL
                OR r."eventId" IS DISTINCT FROM a."eventId"
                OR r."userId" IS DISTINCT FROM a."userId"
                OR r."attendeeName" IS DISTINCT FROM a."fullName"
                OR r."attendeeEmail" IS DISTINCT FROM a.email
                OR r."createdAt" IS DISTINCT FROM a."reviewedAt"
                OR r."revokedAt" IS DISTINCT FROM CASE WHEN a.status = 'WITHDRAWN' THEN a."withdrawnAt" ELSE NULL END
              ELSE r.id IS NOT NULL
            END
            UNION ALL
            SELECT 'application_revision_event', count(*)
            FROM "Application" a
            LEFT JOIN "EventRevision" v ON v.id = a."eventRevisionId" AND v."eventId" = a."eventId"
            WHERE v.id IS NULL
            UNION ALL
            SELECT 'registration_exactly_one_primary',
              count(*) AS invalid_count
            FROM "Registration" r
            LEFT JOIN primary_counts p ON p."registrationId" = r.id
            WHERE p.total IS DISTINCT FROM 1::bigint
            UNION ALL
            SELECT 'guest_identity_and_capability', count(*)
            FROM "Attendee" a LEFT JOIN "Ticket" t ON t."attendeeId" = a.id
            WHERE a.kind = 'GUEST' AND (a."userId" IS NOT NULL OR t."anonymousAccessHash" IS NOT NULL OR t."anonymousAccessEncrypted" IS NOT NULL)
            UNION ALL
            SELECT 'attendee_ticket_lifecycle', count(*)
            FROM "Attendee" a JOIN "Ticket" t ON t."attendeeId" = a.id
            WHERE t."issuedAt" IS DISTINCT FROM a."createdAt"
              OR t."revokedAt" IS DISTINCT FROM a."revokedAt"
            UNION ALL
            SELECT 'attendee_registration_activity', count(*)
            FROM "Attendee" a
            LEFT JOIN "Registration" r ON r.id = a."registrationId"
            WHERE r.id IS NULL OR (r."revokedAt" IS NOT NULL AND a."revokedAt" IS NULL)
            UNION ALL
            SELECT 'primary_registration_identity_history', count(*)
            FROM "Attendee" a
            LEFT JOIN "Registration" r ON r.id = a."registrationId"
            WHERE a.kind = 'PRIMARY' AND (
              r.id IS NULL
              OR a."userId" IS DISTINCT FROM r."userId"
              OR a.name IS DISTINCT FROM r."attendeeName"
              OR a.email IS DISTINCT FROM r."attendeeEmail"
              OR a."createdAt" IS DISTINCT FROM r."createdAt"
              OR a."revokedAt" IS DISTINCT FROM r."revokedAt"
            )
            UNION ALL
            SELECT 'attendee_exactly_one_ticket', count(*)
            FROM "Attendee" a
            LEFT JOIN ticket_counts t ON t."attendeeId" = a.id
            WHERE t.total IS DISTINCT FROM 1::bigint
            UNION ALL
            SELECT 'ticket_has_attendee', count(*)
            FROM "Ticket" t
            LEFT JOIN "Attendee" a ON a.id = t."attendeeId"
            WHERE a.id IS NULL
            UNION ALL
            SELECT 'ticket_anonymous_access_pair', count(*)
            FROM "Ticket"
            WHERE ("anonymousAccessHash" IS NULL) <> ("anonymousAccessEncrypted" IS NULL)
            UNION ALL
            SELECT 'attendance_ticket_attendee_provenance', count(*)
            FROM "Attendance" h
            LEFT JOIN "Attendee" a ON a.id = h."attendeeId"
            LEFT JOIN "Ticket" t ON t.id = h."ticketId"
            WHERE a.id IS NULL
              OR (h.method = 'QR' AND (t.id IS NULL OR h."attendeeId" IS DISTINCT FROM t."attendeeId"))
              OR (h.method = 'MANUAL' AND h."ticketId" IS NOT NULL)
            UNION ALL
            SELECT 'active_registration_primary_capacity', count(*)
            FROM active_registrations r
            FULL JOIN active_primaries a ON a."eventId" = r."eventId"
            WHERE COALESCE(r.total, 0) <> COALESCE(a.total, 0)
            UNION ALL
            SELECT 'current_publication_reference', count(*)
            FROM "Event" e
            LEFT JOIN "EventRevision" v ON v.id = e."publishedRevisionId" AND v."eventId" = e.id
            WHERE e."publishedRevisionId" IS NOT NULL
              AND (v.id IS NULL OR e."publicId" IS NULL OR e."publishedAt" IS NULL)
            UNION ALL
            SELECT 'guest_declaration_positions', count(*) FROM (
              SELECT "applicationId" FROM "ApplicationGuest" GROUP BY "applicationId"
              HAVING min(position) <> 0 OR max(position) <> count(*) - 1
            ) g
            UNION ALL
            SELECT 'guest_declaration_provenance', count(*)
            FROM "Attendee" a
            JOIN "Registration" r ON r.id = a."registrationId"
            LEFT JOIN "ApplicationGuest" g ON g.id = a."applicationGuestId"
            WHERE a."applicationGuestId" IS NOT NULL AND
              (a.kind <> 'GUEST' OR g."applicationId" IS DISTINCT FROM r."sourceApplicationId"
               OR a.name IS DISTINCT FROM g.name OR a.email IS DISTINCT FROM g.email)
            UNION ALL
            SELECT 'declared_group_admission', count(*)
            FROM "ApplicationGuest" g JOIN "Registration" r ON r."sourceApplicationId" = g."applicationId"
            LEFT JOIN "Attendee" a ON a."applicationGuestId" = g.id
            WHERE a.id IS NULL OR a."registrationId" <> r.id OR a."createdAt" <> r."createdAt"
            UNION ALL
            SELECT 'guest_admission_provenance', count(*) FROM "Attendee"
            WHERE (kind = 'GUEST' AND ("applicationGuestId" IS NULL OR "applicationGuestApplicationId" IS NULL))
              OR (kind = 'PRIMARY' AND ("applicationGuestId" IS NOT NULL OR "applicationGuestApplicationId" IS NOT NULL))
            UNION ALL
            SELECT 'application_access_revocation', count(*) FROM "Application"
            WHERE ("anonymousAccessHash" IS NULL) <> ("anonymousAccessEncrypted" IS NULL)
              OR (status = 'WITHDRAWN' AND "anonymousAccessHash" IS NOT NULL)
            UNION ALL
            SELECT 'communication_delivery_count', count(*)
            FROM "Communication" c
            LEFT JOIN delivery_counts d ON d."communicationId" = c.id
            WHERE c."recipientCount" <> COALESCE(d.total, 0)
            UNION ALL
            SELECT 'communication_delivery_type', count(*)
            FROM "EmailOutbox" o
            LEFT JOIN "Communication" c ON c.id = o."communicationId"
            WHERE c.id IS NULL
                OR (c.kind = 'MANUAL' AND o.type <> 'MANUAL_EVENT_MESSAGE')
                OR (c.kind = 'TRANSACTIONAL' AND o.type::text IS DISTINCT FROM c.trigger::text)
            UNION ALL
            SELECT 'communication_request_digest', count(*) FROM "Communication"
            WHERE "requestDigest" !~ '^[a-f0-9]{64}$'
          )
          SELECT invariant, invalid_count FROM checks
          WHERE invalid_count > 0 ORDER BY invariant
        `;

        // Reuse the runtime email contract, including ECMAScript trim semantics.
        // Keep recipient data and frozen payloads in bounded pages only.
        let afterOutboxId: string | undefined;
        let invalidRecipients = BigInt(0);
        let invalidPayloads = BigInt(0);

        while (true) {
          const rows = await tx.emailOutbox.findMany({
            where: {
              ...(afterOutboxId ? { id: { gt: afterOutboxId } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              recipientEmail: true,
              type: true,
              payload: true,
            },
          });

          if (rows.length === 0) {
            break;
          }

          for (const row of rows) {
            if (
              !deliveryAssociationSchema.shape.recipientEmail.safeParse(
                row.recipientEmail,
              ).success
            ) {
              invalidRecipients++;
            }

            const schema =
              row.type === "MANUAL_EVENT_MESSAGE"
                ? manualEmailPayload
                : emailPayloadSchemas[row.type];

            if (!schema.safeParse(row.payload).success) {
              invalidPayloads++;
            }
          }

          afterOutboxId = rows[rows.length - 1].id;
        }

        if (invalidRecipients > BigInt(0)) {
          violations.push({
            invariant: "communication_recipient_normalization",
            invalid_count: invalidRecipients,
          });
        }

        if (invalidPayloads > BigInt(0)) {
          violations.push({
            invariant: "email_outbox_payload_contract",
            invalid_count: invalidPayloads,
          });
        }

        // Strict versioned JSON validation needs application code. Keyset pages
        // bound memory; context and IDs never appear in the report or errors.
        let afterId: string | undefined;
        let invalidContexts = BigInt(0);

        while (true) {
          const rows = await tx.communication.findMany({
            where: afterId ? { id: { gt: afterId } } : {},
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              kind: true,
              trigger: true,
              contextSnapshot: true,
            },
          });

          if (rows.length === 0) {
            break;
          }

          for (const row of rows) {
            const context = communicationContextSchema.safeParse(
              row.contextSnapshot,
            );

            if (
              !context.success ||
              context.data.kind !== row.kind ||
              (context.data.kind === "TRANSACTIONAL" &&
                context.data.trigger !== row.trigger) ||
              (context.data.kind === "MANUAL" && row.trigger !== null)
            ) {
              invalidContexts++;
            }
          }

          afterId = rows[rows.length - 1].id;
        }

        if (invalidContexts > BigInt(0)) {
          violations.push({
            invariant: "communication_context_contract",
            invalid_count: invalidContexts,
          });
        }

        const mediaReferences = await tx.$queryRaw<
          { invariant: string; invalid_count: bigint }[]
        >`
          SELECT 'draft_media_reference' AS invariant, count(*) AS invalid_count
          FROM "Event" e JOIN "MediaAsset" m ON m.id = e."coverAssetId"
          WHERE m.state <> 'READY' OR m."organizerId" <> e."organizerId" OR m."eventId" IS DISTINCT FROM e.id
          UNION ALL
          SELECT 'revision_media_reference', count(*)
          FROM "EventRevision" r JOIN "Event" e ON e.id = r."eventId" JOIN "MediaAsset" m ON m.id = r."coverAssetId"
          WHERE m.state <> 'READY' OR m."organizerId" <> e."organizerId" OR m."eventId" IS DISTINCT FROM e.id
          UNION ALL
          SELECT 'temporary_media_reference', count(*) FROM "MediaAsset" m
          WHERE m."temporaryExpiresAt" IS NOT NULL AND (
            m."eventId" IS NOT NULL OR m."temporaryExpiresAt" <> m."uploadExpiresAt"
            OR EXISTS (SELECT 1 FROM "Event" e WHERE e."coverAssetId" = m.id)
            OR EXISTS (SELECT 1 FROM "EventRevision" r WHERE r."coverAssetId" = m.id)
          )
          UNION ALL
          SELECT 'creation_receipt', count(*) FROM "EventCreationReceipt" c
          LEFT JOIN "Event" e ON e.id = c."eventId"
          WHERE (c."eventId" IS NOT NULL AND (e."organizerId" <> c."organizerId" OR c.result->>'eventId' IS DISTINCT FROM c."eventId"::text))
            OR c.fingerprint !~ '^[a-f0-9]{64}$'
          UNION ALL
          SELECT 'untracked_ready_media_retention', count(*) FROM "MediaAsset" m
          WHERE m.state = 'READY' AND m."unusedSince" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "Event" e WHERE e."coverAssetId" = m.id)
          AND NOT EXISTS (SELECT 1 FROM "EventRevision" r WHERE r."coverAssetId" = m.id)
        `;
        violations.push(
          ...mediaReferences.filter((row) => row.invalid_count > BigInt(0)),
        );
        let mediaCursor: string | undefined;
        let invalidGuests = BigInt(0);
        let guestCursor: string | undefined;

        while (true) {
          const guests = await tx.applicationGuest.findMany({
            where: guestCursor ? { id: { gt: guestCursor } } : {},
            orderBy: { id: "asc" },
            take: 200,
            include: {
              application: {
                select: { eventRevision: { select: { snapshot: true } } },
              },
              answers: { include: { selectedOptions: true } },
            },
          });

          if (!guests.length) {
            break;
          }

          for (const guest of guests) {
            const snapshot = eventSnapshotSchema.safeParse(
              guest.application.eventRevision.snapshot,
            );

            if (
              !applicationInputSchema.shape.fullName.safeParse(guest.name)
                .success ||
              !applicationInputSchema.shape.email.safeParse(guest.email)
                .success ||
              !snapshot.success ||
              guest.position >= snapshot.data.maxGuestsPerRegistration
            ) {
              invalidGuests++;
              continue;
            }

            const fields = snapshot.data.registrationForm.fields;
            const values: Record<string, string[]> = {};
            let valid = guest.answers.length === fields.length;

            for (const answer of guest.answers) {
              const field = fields.find(
                (candidate) => candidate.id === answer.fieldId,
              );
              const text =
                field?.type === "SHORT_TEXT" || field?.type === "LONG_TEXT";
              const checkbox = field?.type === "CHECKBOX";

              if (
                !field ||
                (text &&
                  (answer.booleanValue !== null ||
                    answer.selectedOptions.length > 0)) ||
                (checkbox &&
                  (answer.booleanValue === null ||
                    answer.textValue !== null ||
                    answer.selectedOptions.length > 0)) ||
                (!text &&
                  !checkbox &&
                  (answer.textValue !== null || answer.booleanValue !== null))
              ) {
                valid = false;
              }

              values[answer.fieldId] = text
                ? answer.textValue === null
                  ? []
                  : [answer.textValue]
                : checkbox
                  ? answer.booleanValue
                    ? ["true"]
                    : []
                  : answer.selectedOptions.map((option) => option.optionId);
            }

            if (
              !valid ||
              !applicationAnswersSchema({
                registrationForm: snapshot.data.registrationForm,
              }).safeParse(values).success
            ) {
              invalidGuests++;
            }
          }
          guestCursor = guests[guests.length - 1].id;
        }

        if (invalidGuests > BigInt(0)) {
          violations.push({
            invariant: "guest_declaration_answers",
            invalid_count: invalidGuests,
          });
        }

        let invalidManifests = BigInt(0);

        while (true) {
          const assets = await tx.mediaAsset.findMany({
            where: {
              state: "READY",
              ...(mediaCursor ? { id: { gt: mediaCursor } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: { id: true, manifest: true },
          });

          if (assets.length === 0) {
            break;
          }

          invalidManifests += BigInt(
            assets.filter(
              (asset) => !mediaManifestSchema.safeParse(asset.manifest).success,
            ).length,
          );
          mediaCursor = assets[assets.length - 1].id;
        }

        let revisionCursor: string | undefined;
        let invalidSnapshots = BigInt(0);
        let invalidCoverReferences = BigInt(0);

        while (true) {
          const revisions = await tx.eventRevision.findMany({
            where: {
              ...(revisionCursor ? { id: { gt: revisionCursor } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              snapshot: true,
              coverAssetId: true,
              coverAsset: { select: { manifest: true } },
            },
          });

          if (revisions.length === 0) {
            break;
          }

          for (const revision of revisions) {
            const snapshot = eventSnapshotSchema.safeParse(revision.snapshot);

            if (!snapshot.success) {
              invalidSnapshots++;

              continue;
            }

            const manifest = mediaManifestSchema.safeParse(
              revision.coverAsset?.manifest,
            );

            if (
              (snapshot.data.cover?.assetId ?? null) !==
                revision.coverAssetId ||
              (snapshot.data.cover &&
                (!revision.coverAsset ||
                  (manifest.success &&
                    JSON.stringify(snapshot.data.cover.variants) !==
                      JSON.stringify(manifest.data))))
            ) {
              invalidCoverReferences++;
            }
          }

          revisionCursor = revisions[revisions.length - 1].id;
        }

        violations.push(
          ...[
            {
              invariant: "event_snapshot_contract",
              invalid_count: invalidSnapshots,
            },
            {
              invariant: "media_manifest_contract",
              invalid_count: invalidManifests,
            },
            {
              invariant: "revision_cover_reference",
              invalid_count: invalidCoverReferences,
            },
          ].filter((violation) => violation.invalid_count > BigInt(0)),
        );

        return { connection, counts, violations };
      },
      { isolationLevel: "RepeatableRead", timeout: 60_000 },
    );

    console.table(result.connection);
    console.table(
      result.counts.map(({ entity, total }) => ({
        entity,
        rows: total.toString(),
      })),
    );

    if (result.counts.every(({ total }) => total === BigInt(0))) {
      console.log(
        "Empty database: zero data coverage; no domain rows checked.",
      );
    }

    if (result.violations.length > 0) {
      for (const violation of result.violations) {
        console.error(
          `Database invariant failed: ${violation.invariant}; count=${violation.invalid_count}`,
        );
      }

      process.exitCode = 1;

      return;
    }

    console.log(
      "Database domain integrity checks passed (read-only snapshot).",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Database check failed. Check server environment, PostgreSQL availability and schema compatibility.",
  );
  process.exitCode = 1;
});
