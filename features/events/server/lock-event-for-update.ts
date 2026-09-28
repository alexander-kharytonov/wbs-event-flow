import "server-only";
import { type Event, Prisma } from "@/generated/prisma/client";

// All lifecycle decisions read the old persisted state and one DB clock AFTER
// the Event lock has been acquired. Never use input dates to unlock an operation.
export async function lockEventForUpdate(
  tx: Prisma.TransactionClient,
  where: { id: string; organizerId?: string } | { publicId: string },
) {
  const predicate =
    "id" in where
      ? Prisma.sql`"id" = ${where.id}::uuid ${where.organizerId ? Prisma.sql`AND "organizerId" = ${where.organizerId}::uuid` : Prisma.empty}`
      : Prisma.sql`"publicId" = ${where.publicId}::uuid`;
  const rows = await tx.$queryRaw<Event[]>`
    SELECT * FROM "Event" WHERE ${predicate} FOR UPDATE`;

  if (!rows[0]) {
    return null;
  }

  const [clock] = await tx.$queryRaw<{ decisionNow: Date }[]>`
    SELECT clock_timestamp() AS "decisionNow"`;

  return { ...rows[0], decisionNow: clock.decisionNow };
}
