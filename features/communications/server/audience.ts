import "server-only";
import { z } from "zod";
import { manualCommunicationLimits } from "@/features/communications/server/admission";
import type { ManualAudience } from "@/features/communications/server/contracts";
import { ManualCommunicationError } from "@/features/communications/server/manual-error";
import type { Prisma } from "@/generated/prisma/client";

export const manualAudienceScanLimit = 10_000;

// Caller must authorize first. One bounded statement gives a consistent audience
// even for team email edits, which do not take the Event lock.
export async function resolveManualAudience(
  tx: Prisma.TransactionClient,
  eventId: string,
  audience: ManualAudience,
) {
  const take = manualAudienceScanLimit + 1;
  let rows: { email: string | null }[];

  if (audience === "EVENT_STAFF") {
    rows = await tx.user.findMany({
      where: {
        OR: [
          { organizerProfile: { events: { some: { id: eventId } } } },
          { eventStaff: { some: { eventId } } },
        ],
      },
      select: { email: true },
      take,
    });
  } else if (audience === "PENDING_APPLICATIONS") {
    rows = await tx.application.findMany({
      where: { eventId, status: "PENDING" },
      select: { email: true },
      take,
    });
  } else {
    rows = await tx.attendee.findMany({
      where: {
        revokedAt: null,
        registration: { eventId, revokedAt: null },
        ...(audience === "PRIMARY_ATTENDEES" ? { kind: "PRIMARY" } : {}),
        ...(audience === "CHECKED_IN" ? { attendance: { isNot: null } } : {}),
        ...(audience === "NOT_ARRIVED" ? { attendance: { is: null } } : {}),
      },
      select: { email: true },
      take,
    });
  }

  if (rows.length > manualAudienceScanLimit) {
    throw new ManualCommunicationError(
      "This audience is too large to resolve safely. Choose a smaller audience.",
    );
  }

  const emails = new Set<string>();
  let unavailableCount = 0;

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();

    if (!email || !z.email().safeParse(email).success) {
      unavailableCount += 1;
      continue;
    }

    emails.add(email);
  }

  if (emails.size > manualCommunicationLimits.recipients) {
    throw new ManualCommunicationError(
      "This audience exceeds 1,000 unique recipients. Choose a smaller audience.",
    );
  }

  return { emails: [...emails].sort(), unavailableCount };
}
