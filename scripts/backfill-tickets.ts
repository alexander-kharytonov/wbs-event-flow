import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { prisma } = await import("../lib/prisma");
  const { issueTicket } = await import(
    "../features/tickets/server/issue-ticket"
  );
  const { decryptTicketSecret } = await import("../lib/ticket-crypto");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Run with writers stopped. These locks also serialize concurrent backfills.
        await tx.$executeRaw`LOCK TABLE "user", "Event", "Application", "Registration", "Ticket" IN SHARE ROW EXCLUSIVE MODE`;
        const [history] = await tx.$queryRaw<{ invalid: bigint }[]>`
        SELECT count(*) AS invalid FROM "Application" a
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
            OR a."reviewedAt" < a."createdAt"
            OR r."revokedAt" < r."createdAt"
          ELSE r.id IS NOT NULL END`;

        if (history.invalid !== BigInt(0)) {
          throw new Error(
            "Inconsistent Registration history; no Tickets were backfilled.",
          );
        }

        const registrations = await tx.registration.findMany({
          include: { ticket: true },
          orderBy: { id: "asc" },
        });
        let created = 0;

        for (const registration of registrations) {
          if (!registration.ticket) {
            await issueTicket(tx, registration);
            created += 1;
          }
        }

        const complete = await tx.registration.findMany({
          include: { ticket: true },
        });

        for (const registration of complete) {
          const ticket = registration.ticket;

          if (
            !ticket ||
            ticket.issuedAt.getTime() !== registration.createdAt.getTime() ||
            ticket.revokedAt?.getTime() !== registration.revokedAt?.getTime()
          ) {
            throw new Error("Ticket backfill correspondence failed.");
          }

          decryptTicketSecret(
            ticket.credentialEncrypted,
            registration.id,
            "credential",
            ticket.credentialHash,
          );

          if (
            ticket.anonymousAccessHash !== null &&
            ticket.anonymousAccessEncrypted !== null
          ) {
            decryptTicketSecret(
              ticket.anonymousAccessEncrypted,
              registration.id,
              "access",
              ticket.anonymousAccessHash,
            );
          } else if (
            ticket.anonymousAccessHash !== null ||
            ticket.anonymousAccessEncrypted !== null
          ) {
            throw new Error("Invalid historical Ticket capability pair.");
          }
          // Existing capabilities are historical: never infer them from today's userId.
        }

        return {
          registrations: complete.length,
          created,
          verifiedExisting: complete.length - created,
        };
      },
      { isolationLevel: "ReadCommitted", timeout: 120_000 },
    );
    console.log(
      "Ticket backfill committed; every Registration has exactly one Ticket.",
      result,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Never print Prisma arguments, envelopes, tokens or submitted identity.
  console.error(
    "Ticket backfill failed and rolled back. Check the key, schema and Registration history before retrying.",
  );
  process.exitCode = 1;
});
