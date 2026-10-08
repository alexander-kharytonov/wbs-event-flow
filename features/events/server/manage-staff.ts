import "server-only";
import { z } from "zod";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import {
  reserveStaffResolution,
  resolveStaff,
  staffBudgetMessage,
} from "@/features/events/server/staff-resolution";
import {
  staffEmailSchema,
  staffRoleSchema,
} from "@/features/events/staff-input";
import { prisma } from "@/lib/prisma";
import { notifyEventAccessChanged } from "@/lib/realtime/application-notifications";

const role = staffRoleSchema;
const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("add"),
    eventId: z.uuid(),
    email: staffEmailSchema,
    role,
  }),
  z.strictObject({
    action: z.literal("change"),
    eventId: z.uuid(),
    userId: z.uuid(),
    role,
  }),
  z.strictObject({
    action: z.literal("remove"),
    eventId: z.uuid(),
    userId: z.uuid(),
  }),
]);
export async function manageEventStaff(
  actorUserId: string,
  input: unknown,
): Promise<{
  success?: true;
  message?: string;
  fieldErrors?: Record<string, string>;
}> {
  const parsed = commandSchema.safeParse(input);
  const unavailable = { message: "This staff assignment is unavailable." };

  if (!parsed.success) {
    const emailError = parsed.error.issues.find(
      (issue) => issue.path[0] === "email",
    );

    return emailError
      ? {
          ...unavailable,
          fieldErrors: { email: "Enter a valid email address." },
        }
      : unavailable;
  }

  const command = parsed.data;

  if (
    command.action === "add" &&
    !reserveStaffResolution(actorUserId, [command.email])
  ) {
    return { message: staffBudgetMessage };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const event = await lockEventForUpdate(tx, { id: command.eventId });
        const access =
          event &&
          (await authorizeEventActor(
            tx,
            event.id,
            actorUserId,
            "staff.manage",
          ));

        if (!event || !access) {
          return unavailable;
        }

        let changed = false;

        if (command.action === "add") {
          const { resolved } = await resolveStaff(tx, actorUserId, [command]);
          const user = resolved[0];

          if (!user) {
            return unavailable;
          }

          const existing = await tx.eventStaff.findUnique({
            where: {
              eventId_userId: { eventId: event.id, userId: user.userId },
            },
          });

          if (existing) {
            return existing.role === command.role
              ? { success: true }
              : {
                  message:
                    "This member already has access. Open Manage staff member to update their role.",
                };
          }

          await tx.eventStaff.create({
            data: {
              eventId: event.id,
              userId: user.userId,
              role: command.role,
            },
          });
          changed = true;
        } else if (command.action === "remove") {
          const result = await tx.eventStaff.deleteMany({
            where: { eventId: event.id, userId: command.userId },
          });
          changed = result.count > 0;
        } else {
          const existing = await tx.eventStaff.findUnique({
            where: {
              eventId_userId: { eventId: event.id, userId: command.userId },
            },
          });

          if (!existing) {
            return unavailable;
          }

          if (existing.role !== command.role) {
            await tx.eventStaff.update({
              where: {
                eventId_userId: { eventId: event.id, userId: command.userId },
              },
              data: { role: command.role },
            });
            changed = true;
          }
        }

        if (changed) {
          await notifyEventAccessChanged(tx, event.id);
        }

        return { success: true };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return { message: "Could not update staff. Please try again." };
  }
}
