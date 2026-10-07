import "server-only";
import {
  type BadgeField,
  badgeLayoutSchema,
  validBadgeBindings,
} from "@/features/badges/badge-layout";
import type { Prisma } from "@/generated/prisma/client";

// Caller supplies the appropriate catalog: historical for existing designs,
// newly inserted current fields only for template creation.
export async function writeBadgeLayout(
  tx: Prisma.TransactionClient,
  eventId: string,
  input: unknown,
  fields: BadgeField[],
  updatedAt: Date,
) {
  const layout = badgeLayoutSchema.parse(input);

  if (!validBadgeBindings(layout, fields)) {
    throw new Error("Invalid badge binding.");
  }

  await tx.event.update({
    where: { id: eventId },
    data: { badgeLayout: layout, updatedAt },
  });
}
