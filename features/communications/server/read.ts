import "server-only";
import { queryCommunicationDetails } from "@/features/communications/server/read-details";
import { queryCommunicationHistory } from "@/features/communications/server/read-history";
import type { CommunicationKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export async function readCommunicationHistory(
  eventId: string,
  before?: string,
  filters: { subject?: string; kind?: CommunicationKind } = {},
) {
  const user = await requireVerifiedUser();

  return prisma.$transaction(
    (tx) => queryCommunicationHistory(tx, eventId, user.id, before, filters),
    { isolationLevel: "RepeatableRead", timeout: 15_000 },
  );
}

export async function readCommunicationDetails(
  eventId: string,
  communicationId: string,
  after?: string,
) {
  const user = await requireVerifiedUser();

  return prisma.$transaction(
    (tx) =>
      queryCommunicationDetails(tx, eventId, user.id, communicationId, after),
    { isolationLevel: "RepeatableRead", timeout: 15_000 },
  );
}
