import {
  type EventSnapshot,
  eventSnapshotSchema,
} from "@/features/events/schemas/event-snapshot";

type Answer = {
  fieldId: string;
  textValue: string | null;
  booleanValue: boolean | null;
  selectedOptions: { optionId: string }[];
};
type HistoricalAnswer = {
  fieldId: string;
  label: string;
  description: string | null;
  value: string;
};
const unavailable = "Answer unavailable";

function formatAnswer(
  field: EventSnapshot["registrationForm"]["fields"][number],
  answer: Answer | undefined,
) {
  if (!answer) {
    return unavailable;
  }

  if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
    if (answer.booleanValue !== null || answer.selectedOptions.length > 0) {
      return unavailable;
    }

    return answer.textValue?.trim()
      ? answer.textValue
      : field.required
        ? unavailable
        : "Not provided";
  }

  if (field.type === "CHECKBOX") {
    if (
      answer.textValue !== null ||
      answer.selectedOptions.length > 0 ||
      answer.booleanValue === null ||
      (field.required && !answer.booleanValue)
    ) {
      return unavailable;
    }

    return answer.booleanValue ? "Yes" : "No";
  }

  const ids = answer.selectedOptions.map(({ optionId }) => optionId);

  if (
    answer.textValue !== null ||
    answer.booleanValue !== null ||
    new Set(ids).size !== ids.length ||
    (field.type === "SINGLE_CHOICE" && ids.length > 1)
  ) {
    return unavailable;
  }

  if (ids.length === 0) {
    return field.required ? unavailable : "Not provided";
  }

  const labels = ids.map(
    (id) => field.options.find((option) => option.id === id)?.label,
  );

  if (labels.some((label) => label === undefined)) {
    return unavailable;
  }

  return labels.join(", ");
}

export function historicalAnswers(
  snapshot: unknown,
  answers: Answer[],
): HistoricalAnswer[] | null {
  const parsed = eventSnapshotSchema.safeParse(snapshot);

  if (!parsed.success) {
    return null;
  }

  const fields = parsed.data.registrationForm.fields;
  const result = fields.map((field) => {
    const matches = answers.filter((answer) => answer.fieldId === field.id);

    return {
      fieldId: field.id,
      label: field.label,
      description: field.description,
      value: formatAnswer(field, matches.length === 1 ? matches[0] : undefined),
    };
  });

  for (const answer of answers) {
    if (!fields.some((field) => field.id === answer.fieldId)) {
      result.push({
        fieldId: answer.fieldId,
        label: "Unavailable question",
        description: null,
        value: unavailable,
      });
    }
  }

  return result;
}
