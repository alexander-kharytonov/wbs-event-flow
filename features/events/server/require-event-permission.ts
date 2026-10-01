import "server-only";
import { notFound } from "next/navigation";
import {
  authorizeEventActor,
  type EventPermission,
} from "@/features/events/server/event-access";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export async function requireEventPermission(
  eventId: string,
  permission: EventPermission,
) {
  const user = await requireVerifiedUser();
  const access = await authorizeEventActor(
    prisma,
    eventId,
    user.id,
    permission,
  );

  if (!access) {
    notFound();
  }

  return access;
}
