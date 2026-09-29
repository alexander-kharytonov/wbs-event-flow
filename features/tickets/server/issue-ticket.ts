import "server-only";
import { z } from "zod";
import { Prisma, type Registration } from "@/generated/prisma/client";
import {
  encryptTicketSecret,
  generateTicketNumber,
  generateTicketSecret,
  hashTicketSecret,
} from "@/lib/ticket-crypto";

const numberCollision = z.object({
  driverAdapterError: z.object({
    cause: z.object({
      constraint: z.object({ index: z.literal("Ticket_number_key") }),
    }),
  }),
});

// Caller holds the Event lock (or the backfill table locks).
export async function issueTicket(
  tx: Prisma.TransactionClient,
  registration: Pick<Registration, "id" | "userId" | "createdAt" | "revokedAt">,
) {
  const credential = generateTicketSecret();
  const access = registration.userId === null ? generateTicketSecret() : null;
  const data = {
    registrationId: registration.id,
    credentialHash: hashTicketSecret(credential),
    credentialEncrypted: encryptTicketSecret(
      credential,
      registration.id,
      "credential",
    ),
    anonymousAccessHash: access ? hashTicketSecret(access) : null,
    anonymousAccessEncrypted: access
      ? encryptTicketSecret(access, registration.id, "access")
      : null,
    issuedAt: registration.createdAt,
    revokedAt: registration.revokedAt,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    // A PostgreSQL unique violation aborts the statement's transaction scope.
    // Restore this savepoint before retrying only a support-number collision.
    await tx.$executeRaw`SAVEPOINT ticket_number_issue`;

    try {
      const ticket = await tx.ticket.create({
        data: { ...data, number: generateTicketNumber() },
        select: { id: true },
      });
      await tx.$executeRaw`RELEASE SAVEPOINT ticket_number_issue`;

      return ticket;
    } catch (error) {
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT ticket_number_issue`;
      await tx.$executeRaw`RELEASE SAVEPOINT ticket_number_issue`;

      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          numberCollision.safeParse(error.meta).success
        )
      ) {
        throw error;
      }
    }
  }

  throw new Error("Ticket number allocation failed.");
}
