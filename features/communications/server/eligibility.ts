import "server-only";
import { authorizeEventActor } from "@/features/events/server/event-access";
import type { Prisma } from "@/generated/prisma/client";

// Caller supplies verified session identity, and locks Event before mutation use.
// ReadCommitted ensures a Staff removal committed before that lock is observed.
export async function getCommunicationSendEligibility(
  tx: Prisma.TransactionClient,
  eventId: string,
  verifiedActorUserId: string,
) {
  const actor = await authorizeEventActor(
    tx,
    eventId,
    verifiedActorUserId,
    "communications.send",
  );

  if (!actor) {
    return { allowed: false, reason: "FORBIDDEN" } as const;
  }

  const event = await tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { archivedAt: true, revisions: { take: 1, select: { id: true } } },
  });

  if (event.archivedAt) {
    return { allowed: false, reason: "ARCHIVED" } as const;
  }

  if (event.revisions.length === 0) {
    return { allowed: false, reason: "NEVER_PUBLISHED" } as const;
  }

  return { allowed: true, actor } as const;
}

// Capture from the database after authorization, never from a submitted name/role.
export async function captureCommunicationActor(
  tx: Prisma.TransactionClient,
  actor: NonNullable<Awaited<ReturnType<typeof authorizeEventActor>>>,
) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { name: true },
  });

  return {
    actorUserId: actor.userId,
    actorNameSnapshot: user.name,
    actorRoleSnapshot: actor.role,
  };
}
