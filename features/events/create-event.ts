"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type EventFormState,
  eventFormInput,
  eventInputSchema,
  eventValidationError,
} from "@/features/events/event-input-schema";
import { createEventCore } from "@/features/events/server/create-event-core";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const organizer = await requireOrganizer();
  const input = eventFormInput(formData);
  const parsed = eventInputSchema.safeParse(input);

  if (!parsed.success) {
    return eventValidationError(parsed.error, input);
  }

  let eventId: string;

  try {
    eventId = await prisma.$transaction((tx) =>
      createEventCore(tx, organizer.id, parsed.data),
    );
  } catch {
    return { message: "We couldn’t save your event. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${eventId}`);
}
