import {
  resolveHistoricalAnswer,
  type StoredAnswer,
} from "@/features/events/resolve-historical-answer";
import {
  type EventSnapshot,
  eventSnapshotSchema,
} from "@/features/events/schemas/event-snapshot";

type Answer = StoredAnswer;

export type HistoricalAnswer = {
  fieldId: string;
  label: string | null;
  description: string | null;
  state: "VALUE" | "NOT_PROVIDED" | "UNAVAILABLE";
  value: string | boolean | null;
};

function formatAnswer(
  field: EventSnapshot["registrationForm"]["fields"][number],
  answer: Answer | undefined,
): Pick<HistoricalAnswer, "state" | "value"> {
  const resolved = resolveHistoricalAnswer(field, answer ? [answer] : []);

  if (resolved.state !== "VALUE") {
    return resolved;
  }

  if (Array.isArray(resolved.value)) {
    // Preserve the existing detail UI's stored selection order.
    const labels = answer?.selectedOptions.map(
      ({ optionId }) => field.options.find(({ id }) => id === optionId)?.label,
    );

    return labels
      ? { state: "VALUE", value: labels.join(", ") }
      : { state: "UNAVAILABLE", value: null };
  }

  return { state: resolved.state, value: resolved.value };
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
  const result: HistoricalAnswer[] = fields.map((field) => {
    const matches = answers.filter((answer) => answer.fieldId === field.id);

    return {
      fieldId: field.id,
      label: field.label,
      description: field.description,
      ...formatAnswer(field, matches.length === 1 ? matches[0] : undefined),
    };
  });

  for (const answer of answers) {
    if (!fields.some((field) => field.id === answer.fieldId)) {
      result.push({
        fieldId: answer.fieldId,
        label: null,
        description: null,
        state: "UNAVAILABLE",
        value: null,
      });
    }
  }

  return result;
}
