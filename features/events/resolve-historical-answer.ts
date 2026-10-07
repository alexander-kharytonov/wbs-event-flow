import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export type StoredAnswer = {
  fieldId: string;
  textValue: string | null;
  booleanValue: boolean | null;
  selectedOptions: { optionId: string }[];
};

export type HistoricalField =
  EventSnapshot["registrationForm"]["fields"][number];

export type ResolvedAnswer =
  | { state: "VALUE"; value: string | boolean | string[] }
  | { state: "NOT_PROVIDED"; value: null }
  | { state: "UNAVAILABLE"; value: null };

export function resolveHistoricalAnswer(
  field: HistoricalField,
  answers: StoredAnswer[],
): ResolvedAnswer {
  const unavailable = { state: "UNAVAILABLE", value: null } as const;

  if (answers.length !== 1) {
    return unavailable;
  }

  const answer = answers[0];
  const absent = field.required
    ? unavailable
    : ({ state: "NOT_PROVIDED", value: null } as const);

  if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
    if (answer.booleanValue !== null || answer.selectedOptions.length > 0) {
      return unavailable;
    }

    return answer.textValue?.trim()
      ? { state: "VALUE", value: answer.textValue }
      : absent;
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

    return { state: "VALUE", value: answer.booleanValue };
  }

  const ids = answer.selectedOptions.map(({ optionId }) => optionId);
  const selected = new Set(ids);

  if (
    answer.textValue !== null ||
    answer.booleanValue !== null ||
    selected.size !== ids.length ||
    (field.type === "SINGLE_CHOICE" && ids.length > 1) ||
    ids.some((id) => !field.options.some((option) => option.id === id))
  ) {
    return unavailable;
  }

  if (ids.length === 0) {
    return absent;
  }

  const labels = field.options
    .filter((option) => selected.has(option.id))
    .map((option) => option.label);

  return {
    state: "VALUE",
    value: field.type === "SINGLE_CHOICE" ? labels[0] : labels,
  };
}
