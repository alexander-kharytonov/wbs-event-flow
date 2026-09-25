"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type EventFormState,
  eventInputSchema,
  eventValidationError,
} from "@/features/events/event-input-schema";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export async function updateEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const organizer = await requireOrganizer();
  const id = formData.get("eventId");
  const version = formData.get("version");

  if (typeof id !== "string" || !id || typeof version !== "string") {
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

  const parsed = eventInputSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return eventValidationError(parsed.error);
  }

  try {
    const result = await prisma.event.updateMany({
      where: { id, organizerId: organizer.id, updatedAt },
      data: {
        ...parsed.data,
        contentVersion: { increment: 1 },
        updatedAt: new Date(Math.max(Date.now(), updatedAt.getTime() + 1)),
      },
    });

    if (result.count !== 1) {
      // This read only chooses a safe error; authorization and concurrency are
      // enforced together by the database write above.
      const ownedEvent = await prisma.event.findFirst({
        where: { id, organizerId: organizer.id },
        select: { id: true },
      });

      if (!ownedEvent) {
        return { message: "This event is unavailable for editing." };
      }

      return {
        conflict: true,
        message:
          "This event changed while you were editing it. Reload the latest version and try again.",
      };
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
