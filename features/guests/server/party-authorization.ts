import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { hashTicketSecret, isTicketSecret } from "@/lib/ticket-crypto";

// Linked actor is constructed only from an authoritative verified session.
export type PartyActor =
  | { userId: string; registrationId: string }
  | { capability: string };

// Also used after the Event lock; a candidate lookup never authorizes a write.
export async function authorizeParty(
  tx: Prisma.TransactionClient,
  actor: PartyActor,
) {
  if ("userId" in actor) {
    if (!z.uuid().safeParse(actor.registrationId).success) {
      return null;
    }

    return tx.registration.findFirst({
      where: { id: actor.registrationId, userId: actor.userId },
      select: { id: true, eventId: true },
    });
  }

  if (
    typeof actor.capability !== "string" ||
    !isTicketSecret(actor.capability)
  ) {
    return null;
  }

  const ticket = await tx.ticket.findUnique({
    where: { anonymousAccessHash: hashTicketSecret(actor.capability) },
    select: {
      attendee: {
        select: {
          kind: true,
          registration: { select: { id: true, eventId: true } },
        },
      },
    },
  });

  return ticket?.attendee.kind === "PRIMARY"
    ? ticket.attendee.registration
    : null;
}
