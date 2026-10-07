import {
  type HistoricalField,
  resolveHistoricalAnswer,
  type StoredAnswer,
} from "@/features/events/resolve-historical-answer";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import {
  type CsvCell,
  ExportError,
  MAX_EXPORT_COLUMNS,
} from "@/features/exports/csv";

export type AnswerColumn = {
  revisionId: string;
  field: HistoricalField;
  header: string;
};

export function revisionColumns(
  revision: { id: string; number: number; snapshot: unknown },
  existingColumns: number,
): AnswerColumn[] {
  const parsed = eventSnapshotSchema.safeParse(revision.snapshot);

  if (!parsed.success) {
    throw new ExportError(
      "Historical registration data is unavailable. No partial file was produced.",
    );
  }

  if (
    existingColumns + parsed.data.registrationForm.fields.length * 2 >
    MAX_EXPORT_COLUMNS
  ) {
    throw new ExportError(
      "Export exceeds the 500-column limit. No partial file was produced.",
    );
  }

  return parsed.data.registrationForm.fields.map((field, index) => ({
    revisionId: revision.id,
    field,
    header: `${field.label} [v${revision.number} Q${index + 1} ${field.type}]`,
  }));
}

export function answerCells(
  columns: AnswerColumn[],
  revisionId: string,
  answers: StoredAnswer[],
  applicable: boolean,
): CsvCell[] {
  const submittedFieldIds = new Set(
    columns
      .filter((column) => column.revisionId === revisionId)
      .map((column) => column.field.id),
  );

  if (
    applicable &&
    answers.some((answer) => !submittedFieldIds.has(answer.fieldId))
  ) {
    throw new ExportError(
      "Historical registration data is unavailable. No partial file was produced.",
    );
  }

  const byField = new Map<string, StoredAnswer[]>();

  for (const answer of answers) {
    const matches = byField.get(answer.fieldId) ?? [];
    matches.push(answer);
    byField.set(answer.fieldId, matches);
  }

  return columns.flatMap((column): CsvCell[] => {
    if (!applicable || column.revisionId !== revisionId) {
      return [null, "NOT_APPLICABLE"];
    }

    const matches = byField.get(column.field.id);

    if (!matches) {
      return [null, "NOT_PROVIDED"];
    }

    const resolved = resolveHistoricalAnswer(column.field, matches);

    return [
      Array.isArray(resolved.value)
        ? JSON.stringify(resolved.value)
        : resolved.value,
      resolved.state,
    ];
  });
}
