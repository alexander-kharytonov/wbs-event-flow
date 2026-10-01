import "server-only";
import { z } from "zod";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";
import { notifyEventAccessChanged } from "@/lib/realtime/application-notifications";

const role = z.enum(["MANAGER", "RECEPTION"]);
const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("add"),
    eventId: z.uuid(),
    email: z.string().trim().toLowerCase().pipe(z.email()),
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
const attempts = new Map<string, { count: number; expiresAt: number }>();

// Deliberately local to Add Staff: 10 attempts/minute per owner per process.
// Expired entries are discarded; a full map fails closed instead of evicting limits.
function allowAddAttempt(userId: string) {
  const now = Date.now();

  for (const [key, value] of attempts) {
    if (value.expiresAt <= now) {
      attempts.delete(key);
    }
  }

  const current = attempts.get(userId);

  if (current) {
    current.count += 1;

    return current.count <= 10;
  }

  if (attempts.size >= 10000) {
    return false;
  }

  attempts.set(userId, { count: 1, expiresAt: now + 60000 });

  return true;
}

export async function manageEventStaff(
  actorUserId: string,
  input: unknown,
): Promise<{ success?: true; message?: string }> {
  const parsed = commandSchema.safeParse(input);
  const unavailable = { message: "This staff assignment is unavailable." };

  if (!parsed.success) {
    return unavailable;
  }

  const command = parsed.data;

  if (command.action === "add" && !allowAddAttempt(actorUserId)) {
    return { message: "Too many attempts. Please try again in a minute." };
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
          const user = await tx.user.findUnique({
            where: { email: command.email },
            select: { id: true, emailVerified: true },
          });

          if (!user?.emailVerified || user.id === actorUserId) {
            return unavailable;
          }

          const existing = await tx.eventStaff.findUnique({
            where: { eventId_userId: { eventId: event.id, userId: user.id } },
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
            data: { eventId: event.id, userId: user.id, role: command.role },
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
