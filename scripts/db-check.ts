import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { prisma } = await import("../lib/prisma");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const connection = await tx.$queryRaw<
          { database: string; version: string; ok: number }[]
        >`SELECT current_database() AS database, version() AS version, 1 AS ok`;
        // One consistent snapshot; only aggregate counts leave the database.
        // Party and person invariants apply to PRIMARY and GUEST.
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
          ), checks AS (
            SELECT 'registration_exactly_one_primary' AS invariant,
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
            JOIN "Registration" r ON r.id = a."registrationId"
            WHERE t."issuedAt" IS DISTINCT FROM a."createdAt"
              OR t."revokedAt" IS DISTINCT FROM a."revokedAt"
              OR (r."revokedAt" IS NOT NULL AND a."revokedAt" IS NULL)
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
            SELECT 'attendance_ticket_attendee_provenance', count(*)
            FROM "Attendance" h
            LEFT JOIN "Ticket" t ON t.id = h."ticketId"
            WHERE (h.method = 'QR' AND (t.id IS NULL OR h."attendeeId" IS DISTINCT FROM t."attendeeId"))
              OR (h.method = 'MANUAL' AND h."ticketId" IS NOT NULL)
            UNION ALL
            SELECT 'active_registration_primary_capacity', count(*)
            FROM active_registrations r
            FULL JOIN active_primaries a ON a."eventId" = r."eventId"
            WHERE COALESCE(r.total, 0) <> COALESCE(a.total, 0)
          )
          SELECT invariant, invalid_count FROM checks
          WHERE invalid_count > 0 ORDER BY invariant
        `;

        return { connection, violations };
      },
      { isolationLevel: "RepeatableRead" },
    );

    if (result.violations.length > 0) {
      for (const violation of result.violations) {
        console.error(
          `Database invariant failed: ${violation.invariant}; count=${violation.invalid_count}`,
        );
      }

      process.exitCode = 1;

      return;
    }

    console.table(result.connection);
    console.log("Database party/Attendee invariants passed.");
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
