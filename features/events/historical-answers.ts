import {
  resolveHistoricalAnswer,
  type StoredAnswer,
} from "@/features/events/resolve-historical-answer";
import {
  type EventSnapshot,
  eventSnapshotSchema,
} from "@/features/events/schemas/event-snapshot";

type Answer = StoredAnswer;
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
  const resolved = resolveHistoricalAnswer(field, answer ? [answer] : []);

  if (resolved.state === "UNAVAILABLE") {
    return unavailable;
  }

  if (resolved.state === "NOT_PROVIDED") {
    return "Not provided";
  }

  if (typeof resolved.value === "boolean") {
    return resolved.value ? "Yes" : "No";
  }

  if (Array.isArray(resolved.value)) {
    // Preserve the existing detail UI's stored selection order.
    return (
      answer?.selectedOptions
        .map(
          ({ optionId }) =>
            field.options.find(({ id }) => id === optionId)?.label,
        )
        .join(", ") ?? unavailable
    );
  }

  return resolved.value;
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
