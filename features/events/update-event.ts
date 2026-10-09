"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  eventDateSource,
  parseEventEdit,
} from "@/features/events/event-form-values";
import {
  type EventFormState,
  eventDateFields,
  eventFormInput,
  eventValidationError,
} from "@/features/events/event-input-schema";
import {
  eventLifecycle,
  workspaceReadOnly,
} from "@/features/events/event-lifecycle";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyEventChanged } from "@/lib/realtime/application-notifications";

export async function updateEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const organizer = await requireOrganizer();
  const id = formData.get("eventId");
  const version = formData.get("version");

  if (
    typeof id !== "string" ||
    !z.uuid().safeParse(id).success ||
    typeof version !== "string"
  ) {
    return {
      message: "We couldn’t save this event. Reload the page and try again.",
    };
  }

  // The opaque version is only a write condition, never an updatedAt value.
  const timestamp = Buffer.from(version, "base64url").toString("utf8");
  const updatedAt = new Date(timestamp);

  if (
    !Number.isFinite(updatedAt.getTime()) ||
    updatedAt.toISOString() !== timestamp ||
    Buffer.from(timestamp).toString("base64url") !== version
  ) {
    return {
      message: "We couldn’t save this event. Reload the page and try again.",
    };
  }

  const editedDates = z
    .array(z.enum(eventDateFields))
    .max(4)
    .safeParse(formData.getAll("editedDate"));

  if (!editedDates.success) {
    return {
      message: "We couldn’t save this event. Reload the page and try again.",
    };
  }

  const input = eventFormInput(formData);

  try {
    const outcome = await prisma.$transaction(
      async (tx): Promise<EventFormState | null> => {
        const event = await lockEventForUpdate(tx, {
          id,
          organizerId: organizer.id,
        });

        if (!event) {
          return { message: "This event is unavailable for editing." };
        }

        if (workspaceReadOnly(event, event.decisionNow)) {
          return { message: "This event is read-only." };
        }

        if (event.updatedAt.getTime() !== updatedAt.getTime()) {
          return {
            conflict: true,
            message:
              "This event changed while you were editing it. Reload the latest version and try again.",
          };
        }

        const parsed = parseEventEdit(
          input,
          eventDateSource(event),
          editedDates.data,
          eventLifecycle(event, event.decisionNow) === "Ongoing",
        );

        if (!parsed.success) {
          return eventValidationError(parsed.error, input);
        }

        if (
          eventLifecycle(event, event.decisionNow) === "Ongoing" &&
          (parsed.data.startsAt.getTime() !== event.startsAt.getTime() ||
            parsed.data.endsAt <= event.decisionNow)
        ) {
          return {
            message:
              "An ongoing event must keep its original start and end after the current time.",
          };
        }

        const result = await tx.event.updateMany({
          where: { id, organizerId: organizer.id, updatedAt },
          data: {
            ...parsed.data,
            location: parsed.data.location ?? Prisma.DbNull,
            publicOrganizer: parsed.data.publicOrganizer ?? Prisma.DbNull,
            contentVersion: { increment: 1 },
            updatedAt: new Date(
              Math.max(event.decisionNow.getTime(), updatedAt.getTime() + 1),
            ),
          },
        });

        if (result.count !== 1) {
          return {
            conflict: true,
            message: "This event changed. Reload and try again.",
          };
        }

        await notifyEventChanged(tx, id);

        return null;
      },
      { isolationLevel: "ReadCommitted" },
    );

    if (outcome) {
      return outcome;
    }
  } catch {
    return { message: "We couldn’t save your changes. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${id}`);
  revalidatePath(`/dashboard/events/${id}/edit`);
  revalidatePath(`/dashboard/events/${id}/preview`);
  revalidatePath(`/dashboard/events/${id}/registration-form`);
  redirect(`/dashboard/events/${id}`);
}
