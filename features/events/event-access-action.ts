"use server";

import { authorizeEventActor } from "@/features/events/server/event-access";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function readCurrentEventAccess(eventId: string) {
  const session = await getSession();

  if (!session?.user.emailVerified) {
    return null;
  }

  const access = await authorizeEventActor(
    prisma,
    eventId,
    session.user.id,
    "event.context.read",
  );

  return access?.role ?? null;
}
