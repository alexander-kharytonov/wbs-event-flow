import "server-only";
import { applicationGuestsSchema } from "@/features/events/application-input";
import type { StoredAnswer } from "@/features/events/resolve-historical-answer";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import type { Prisma } from "@/generated/prisma/client";

export const applicationGuestSelect = {
  id: true,
  position: true,
  name: true,
  email: true,
  answers: {
    select: {
      fieldId: true,
      textValue: true,
      booleanValue: true,
      selectedOptions: { select: { optionId: true } },
    },
  },
} satisfies Prisma.ApplicationGuestSelect;

type Declaration = {
  position: number;
  name: string;
  email: string | null;
  answers: StoredAnswer[];
};

// Validate the persisted representation as well as the original input contract.
// Never normalize corrupt historical data into an admissible group.
export function validApplicationGuests(
  snapshot: EventSnapshot,
  guests: Declaration[],
) {
  const fields = snapshot.registrationForm.fields;
  const input = [];

  for (const [index, guest] of guests.entries()) {
    if (
      guest.position !== index ||
      guest.name !== guest.name.trim() ||
      (guest.email !== null &&
        guest.email !== guest.email.trim().toLowerCase()) ||
      guest.answers.length !== fields.length ||
      new Set(guest.answers.map(({ fieldId }) => fieldId)).size !==
        fields.length
    ) {
      return false;
    }
    const answers: Record<string, string[]> = {};

    for (const answer of guest.answers) {
      const field = fields.find(({ id }) => id === answer.fieldId);
      const text = field?.type === "SHORT_TEXT" || field?.type === "LONG_TEXT";
      const checkbox = field?.type === "CHECKBOX";

      if (
        !field ||
        (text &&
          (answer.booleanValue !== null ||
            answer.selectedOptions.length > 0)) ||
        (checkbox &&
          (answer.booleanValue === null ||
            answer.textValue !== null ||
            answer.selectedOptions.length > 0)) ||
        (!text &&
          !checkbox &&
          (answer.textValue !== null || answer.booleanValue !== null))
      ) {
        return false;
      }
      answers[answer.fieldId] = text
        ? answer.textValue === null
          ? []
          : [answer.textValue]
        : checkbox
          ? answer.booleanValue
            ? ["true"]
            : []
          : answer.selectedOptions.map(({ optionId }) => optionId);
    }
    input.push({ name: guest.name, email: guest.email, answers });
  }

  return applicationGuestsSchema(snapshot).safeParse(input).success;
}
