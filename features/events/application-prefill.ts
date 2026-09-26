import {
  type EventSnapshot,
  eventSnapshotSchema,
} from "@/features/events/schemas/event-snapshot";

type PreviousAnswer = {
  fieldId: string;
  textValue: string | null;
  booleanValue: boolean | null;
  selectedOptions: { optionId: string }[];
};

// Compare the full published field definition, not only its persistent ID.
export function applicationPrefill(
  current: EventSnapshot,
  previousSnapshot: unknown,
  answers: PreviousAnswer[],
): Record<string, string[]> {
  const previous = eventSnapshotSchema.safeParse(previousSnapshot);
  const values: Record<string, string[]> = {};

  if (!previous.success) {
    return values;
  }

  for (const field of current.registrationForm.fields) {
    const oldField = previous.data.registrationForm.fields.find(
      (candidate) => candidate.id === field.id,
    );
    const answer = answers.find((candidate) => candidate.fieldId === field.id);

    if (
      !answer ||
      !oldField ||
      JSON.stringify(oldField) !== JSON.stringify(field)
    ) {
      continue;
    }

    values[`answer:${field.id}`] =
      field.type === "CHECKBOX"
        ? answer.booleanValue
          ? ["true"]
          : []
        : field.type === "SHORT_TEXT" || field.type === "LONG_TEXT"
          ? [answer.textValue ?? ""]
          : answer.selectedOptions.map(({ optionId }) => optionId);
  }

  return values;
}
