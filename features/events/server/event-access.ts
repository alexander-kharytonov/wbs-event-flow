import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const permissions = {
  OWNER: [
    "communications.read",
    "communications.send",
    "event.context.read",
    "applications.read",
    "applications.review",
    "attendees.read.full",
    "attendees.read.reception",
    "checkIn.qr",
    "checkIn.manual",
    "event.edit",
    "registrationForm.edit",
    "event.preview",
    "event.publish",
    "event.lifecycle.manage",
    "staff.manage",
    "badges.configure",
    "badges.print.individual",
    "badges.print.bulk",
    "badges.print.team",
  ],
  MANAGER: [
    "communications.read",
    "communications.send",
    "badges.print.individual",
    "badges.print.bulk",
    "badges.print.team",
    "event.context.read",
    "applications.read",
    "applications.review",
    "attendees.read.full",
    "attendees.read.reception",
    "checkIn.qr",
    "checkIn.manual",
  ],
  RECEPTION: [
    "badges.print.individual",
    "event.context.read",
    "attendees.read.reception",
    "checkIn.qr",
    "checkIn.manual",
  ],
} as const;

export type EventRole = keyof typeof permissions;
export type EventPermission = (typeof permissions.OWNER)[number];

export function hasEventPermission(
  role: EventRole,
  permission: EventPermission,
) {
  return (permissions[role] as readonly string[]).includes(permission);
}

// For mutations, call with the transaction AFTER taking Event FOR UPDATE.
export async function authorizeEventActor(
  db: Prisma.TransactionClient,
  eventId: string,
  userId: string,
  permission: EventPermission,
) {
  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });

  if (!event) {
    return null;
  }

  const owner = await db.organizerProfile.findUniqueOrThrow({
    where: { id: event.organizerId },
    select: { userId: true },
  });
  const membership =
    owner.userId === userId
      ? null
      : await db.eventStaff.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { role: true },
        });
  const role: EventRole | undefined =
    owner.userId === userId ? "OWNER" : membership?.role;

  if (!role || !hasEventPermission(role, permission)) {
    return null;
  }

  return { role, userId };
}
