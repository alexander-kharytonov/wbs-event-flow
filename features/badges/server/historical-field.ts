import "server-only";
import type { BadgeField } from "@/features/badges/badge-layout";
import { badgeText } from "@/features/badges/badge-presentation";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";

type Answer = {
  fieldId: string;
  textValue: string | null;
  booleanValue: boolean | null;
  selectedOptions: { optionId: string }[];
};

export function resolveBadgeField(
  binding: BadgeField,
  snapshot: unknown,
  answers: Answer[],
):
  | { status: "VALUE"; value: string }
  | { status: "MISSING" | "INCOMPATIBLE" | "UNAVAILABLE" } {
  const parsed = eventSnapshotSchema.safeParse(snapshot);

  if (!parsed.success) {
    return { status: "UNAVAILABLE" };
  }

  const field = parsed.data.registrationForm.fields.find(
    ({ id }) => id === binding.fieldId,
  );

  if (!field) {
    return { status: "MISSING" };
  }

  if (field.type !== binding.type || field.label !== binding.label) {
    return { status: "INCOMPATIBLE" };
  }

  const matches = answers.filter(({ fieldId }) => fieldId === binding.fieldId);

  if (matches.length === 0) {
    return { status: "MISSING" };
  }

  if (matches.length !== 1) {
    return { status: "UNAVAILABLE" };
  }

  const answer = matches[0];

  if (answer.booleanValue !== null) {
    return { status: "UNAVAILABLE" };
  }

  let value: string;

  if (field.type === "SINGLE_CHOICE" || field.type === "MULTIPLE_CHOICE") {
    if (
      answer.textValue !== null ||
      (field.type === "SINGLE_CHOICE" && answer.selectedOptions.length > 1)
    ) {
      return { status: "UNAVAILABLE" };
    }

    if (answer.selectedOptions.length === 0) {
      return { status: "MISSING" };
    }

    const selectedIds = new Set(
      answer.selectedOptions.map(({ optionId }) => optionId),
    );
    const selected = field.options.filter(({ id }) => selectedIds.has(id));

    if (
      selectedIds.size !== answer.selectedOptions.length ||
      selected.length !== selectedIds.size
    ) {
      return { status: "UNAVAILABLE" };
    }

    value = selected.map(({ label }) => label).join(", ");
  } else {
    if (answer.selectedOptions.length > 0) {
      return { status: "UNAVAILABLE" };
    }

    value = answer.textValue ?? "";
  }

  const normalized = badgeText(value);

  return normalized
    ? { status: "VALUE", value: normalized }
    : { status: "MISSING" };
}
