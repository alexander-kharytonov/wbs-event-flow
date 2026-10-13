"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  type EventFormState,
  eventFormInput,
  eventInputSchema,
  eventValidationError,
} from "@/features/events/event-input-schema";
import { createEventCore } from "@/features/events/server/create-event-core";
import { draftEventPassword } from "@/features/events/server/event-password";
import { isEventPasswordOrigin } from "@/features/events/server/event-password-session";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const organizer = await requireOrganizer();

  if (!isEventPasswordOrigin(await headers())) {
    return { message: "inputSaveFailed" };
  }
  const input = eventFormInput(formData);
  const parsed = eventInputSchema.safeParse(input);

  if (!parsed.success) {
    return eventValidationError(parsed.error, input);
  }

  let eventId: string;

  try {
    const password = await draftEventPassword(
      formData,
      parsed.data.visibility,
      null,
    );

    if (password.error) {
      return { errors: { eventPassword: [password.error] } };
    }
    eventId = await prisma.$transaction(async (tx) => {
      const id = await createEventCore(tx, organizer.id, parsed.data);
      await tx.event.update({
        where: { id },
        data: { draftPasswordHash: password.hash },
      });

      return id;
    });
  } catch {
    return { message: "inputSaveFailed" };
  }

  revalidatePath("/dashboard");

  return { createdId: eventId };
}
