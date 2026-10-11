import "server-only";
import { z } from "zod";
import { manualCommunicationLimits } from "@/features/communications/server/admission";
import type { ManualAudience } from "@/features/communications/server/contracts";
import { ManualCommunicationError } from "@/features/communications/server/manual-error";
import { Prisma } from "@/generated/prisma/client";
import { recipientEmailLocale } from "@/lib/i18n/email-locale";
import type { UiLocale } from "@/lib/i18n/locale";

export const manualAudienceScanLimit = 10_000;

type Recipient = {
  email: string | null;
  userId: string | null;
  uiLocale: string | null;
  language: string | null;
};

// Caller authorizes first. A single bounded statement reads contact and language
// together. Never infer an account from an email or use a Guest's Primary account.
export async function resolveManualAudience(
  tx: Prisma.TransactionClient,
  eventId: string,
  audience: ManualAudience,
) {
  const take = manualAudienceScanLimit + 1;
  let rows: Recipient[];

  if (audience === "EVENT_STAFF") {
    rows = await tx.$queryRaw<Recipient[]>`
      SELECT u.email, u.id AS "userId", u."uiLocale", NULL::text AS language
      FROM "user" u
      WHERE EXISTS (
        SELECT 1 FROM "OrganizerProfile" o JOIN "Event" e ON e."organizerId" = o.id
        WHERE o."userId" = u.id AND e.id = ${eventId}::uuid
      ) OR EXISTS (
        SELECT 1 FROM "EventStaff" s WHERE s."userId" = u.id AND s."eventId" = ${eventId}::uuid
      )
      ORDER BY u."createdAt", u.id LIMIT ${take}`;
  } else if (audience === "PENDING_APPLICATIONS") {
    rows = await tx.$queryRaw<Recipient[]>`
      SELECT a.email, u.id AS "userId", u."uiLocale", r.snapshot->>'language' AS language
      FROM "Application" a
      JOIN "EventRevision" r ON r.id = a."eventRevisionId" AND r."eventId" = a."eventId"
      LEFT JOIN "user" u ON u.id = a."userId"
      WHERE a."eventId" = ${eventId}::uuid AND a.status = 'PENDING'
      ORDER BY a."createdAt", a.id LIMIT ${take}`;
  } else {
    const kind =
      audience === "PRIMARY_ATTENDEES"
        ? Prisma.sql`AND a.kind = 'PRIMARY'`
        : Prisma.empty;
    const attendance =
      audience === "CHECKED_IN"
        ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Attendance" c WHERE c."attendeeId" = a.id)`
        : audience === "NOT_ARRIVED"
          ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "Attendance" c WHERE c."attendeeId" = a.id)`
          : Prisma.empty;
    rows = await tx.$queryRaw<Recipient[]>(Prisma.sql`
      SELECT a.email, u.id AS "userId", u."uiLocale", v.snapshot->>'language' AS language
      FROM "Attendee" a
      JOIN "Registration" r ON r.id = a."registrationId"
      JOIN "Application" p ON p.id = r."sourceApplicationId" AND p."eventId" = r."eventId"
      JOIN "EventRevision" v ON v.id = p."eventRevisionId" AND v."eventId" = p."eventId"
      LEFT JOIN "user" u ON u.id = a."userId"
      WHERE r."eventId" = ${eventId}::uuid AND r."revokedAt" IS NULL AND a."revokedAt" IS NULL
      ${kind} ${attendance}
      ORDER BY r."createdAt", r.id, a.id LIMIT ${take}`);
  }

  if (rows.length > manualAudienceScanLimit) {
    throw new ManualCommunicationError("commTooLarge");
  }

  const recipients = new Map<string, { locale: UiLocale; linked: boolean }>();
  let unavailableCount = 0;

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();

    if (!email || !z.email().safeParse(email).success) {
      unavailableCount += 1;
      continue;
    }

    const previous = recipients.get(email);
    const linked = row.userId !== null;

    // Rows are earliest-first with stable UUID ties. An explicitly linked
    // account wins even when its preference is absent (then English wins).
    if (!previous || (linked && !previous.linked)) {
      recipients.set(email, {
        linked,
        locale: recipientEmailLocale(
          linked ? { uiLocale: row.uiLocale } : null,
          { language: row.language },
        ),
      });
    }
  }

  if (recipients.size > manualCommunicationLimits.recipients) {
    throw new ManualCommunicationError("commTooMany");
  }

  return {
    emails: [...recipients.keys()].sort(),
    locales: new Map(
      [...recipients].map(([email, recipient]) => [email, recipient.locale]),
    ),
    unavailableCount,
  };
}
