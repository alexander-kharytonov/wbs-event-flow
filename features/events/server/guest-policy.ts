import "server-only";
import { z } from "zod";
import { workspaceReadOnly } from "@/features/events/event-lifecycle";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";
import { notifyEventChanged } from "@/lib/realtime/application-notifications";

const policyInput = z.strictObject({
  eventId: z.uuid(),
  version: z.iso.datetime({ precision: 3 }),
  guestPolicy: z.enum(["FLEXIBLE", "APPROVAL_REQUIRED"]),
});

// actorUserId is supplied by the verified server session, never client input.
export async function updateGuestPolicy(actorUserId: string, input: unknown) {
  const parsed = policyInput.safeParse(input);

  if (!parsed.success) {
    return { code: "INVALID_INPUT" } as const;
  }

  const command = parsed.data;

  return prisma.$transaction(
    async (tx) => {
      const event = await lockEventForUpdate(tx, { id: command.eventId });
      const access =
        event &&
        (await authorizeEventActor(tx, event.id, actorUserId, "event.edit"));

      if (!access || !event || workspaceReadOnly(event, event.decisionNow)) {
        return { code: "UNAVAILABLE" } as const;
      }

      if (event.updatedAt.toISOString() !== command.version) {
        return { code: "CONFLICT" } as const;
      }

      if (event.guestPolicy === command.guestPolicy) {
        return { code: "UNCHANGED" } as const;
      }

      if (await tx.application.count({ where: { eventId: event.id } })) {
        return { code: "POLICY_LOCKED" } as const;
      }

      if (
        command.guestPolicy === "FLEXIBLE" &&
        (await tx.registrationField.count({
          where: { form: { eventId: event.id }, subject: "GUEST" },
        }))
      ) {
        return { code: "GUEST_FIELDS_EXIST" } as const;
      }

      const saved = await tx.event.update({
        where: { id: event.id },
        data: {
          guestPolicy: command.guestPolicy,
          contentVersion: { increment: 1 },
          updatedAt: new Date(
            Math.max(
              event.decisionNow.getTime(),
              event.updatedAt.getTime() + 1,
            ),
          ),
        },
        select: { updatedAt: true },
      });
      await notifyEventChanged(tx, event.id);

      return { code: "SAVED", version: saved.updatedAt.toISOString() } as const;
    },
    { isolationLevel: "ReadCommitted" },
  );
}
