import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Publish and review serialize on the same owned Event row. Call before reads.
export async function lockEventForUpdate(
  tx: Prisma.TransactionClient,
  eventId: string,
  organizerId: string,
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Event"
    WHERE "id" = ${eventId} AND "organizerId" = ${organizerId}
    FOR UPDATE`;

  return rows.length === 1;
}
