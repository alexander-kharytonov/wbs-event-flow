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
import {
  createEventWithCover,
  creationInput,
} from "@/features/events/server/create-event-with-cover";
import { draftEventPassword } from "@/features/events/server/event-password";
import { isEventPasswordOrigin } from "@/features/events/server/event-password-session";
import { MediaError } from "@/features/events/server/media-image";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

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
    const result = await createEventWithCover(
      organizer.id,
      creationInput(formData),
      {
        kind: "manual",
        event: parsed.data,
        passwordProtection: formData.get("passwordProtection"),
        eventPassword: formData.get("eventPassword"),
      },
      async (tx) => {
        const id = await createEventCore(tx, organizer.id, parsed.data);
        await tx.event.update({
          where: { id },
          data: { draftPasswordHash: password.hash },
        });

        return {
          eventId: id,
          addedCount: 0,
          skippedEmails: [],
          duplicateWarnings: [],
        };
      },
    );
    eventId = result.eventId;
  } catch (error) {
    return {
      message:
        error instanceof MediaError ? error.code : "inputSaveUnconfirmed",
      creationUncertain: !(error instanceof MediaError),
    };
  }

  revalidatePath("/dashboard");

  return { createdId: eventId };
}
