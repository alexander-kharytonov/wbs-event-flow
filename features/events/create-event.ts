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

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const organizer = await requireOrganizer();
  const parsed = eventInputSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return eventValidationError(parsed.error);
  }

  let eventId: string;

  try {
    const event = await prisma.event.create({
      data: {
        ...parsed.data,
        organizerId: organizer.id,
        publishedAt: null,
        registrationForm: { create: {} },
      },
      select: { id: true },
    });
    eventId = event.id;
  } catch {
    return { message: "We couldn’t save your event. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${eventId}`);
}
