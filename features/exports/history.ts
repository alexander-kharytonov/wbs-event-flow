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
  subject: "APPLICANT" | "GUEST";
  field: HistoricalField;
  header: string;
};

export function revisionColumns(
  revision: { id: string; number: number; snapshot: unknown },
  existingColumns: number,
): AnswerColumn[] {
  const parsed = eventSnapshotSchema.safeParse(revision.snapshot);

  if (!parsed.success) {
    throw new ExportError("exportHistory");
  }

  const fields = [
    ...parsed.data.registrationForm.fields.map((field) => ({
      field,
      subject: "APPLICANT" as const,
    })),
    ...parsed.data.guestForm.fields.map((field) => ({
      field,
      subject: "GUEST" as const,
    })),
  ];

  if (existingColumns + fields.length * 2 > MAX_EXPORT_COLUMNS) {
    throw new ExportError("exportColumns");
  }

  return fields.map(({ field, subject }) => ({
    subject,
    revisionId: revision.id,
    field,
    header: `${field.label} [${subject} v${revision.number} ${field.type} ${revision.id}:${field.id}]`,
  }));
}

export function answerCells(
  columns: AnswerColumn[],
  revisionId: string,
  answers: StoredAnswer[],
  subject: "APPLICANT" | "GUEST" | null,
): CsvCell[] {
  const submittedFieldIds = new Set(
    columns
      .filter(
        (column) =>
          column.revisionId === revisionId && column.subject === subject,
      )
      .map((column) => column.field.id),
  );

  if (
    subject !== null &&
    answers.some((answer) => !submittedFieldIds.has(answer.fieldId))
  ) {
    throw new ExportError("exportHistory");
  }

  const byField = new Map<string, StoredAnswer[]>();

  for (const answer of answers) {
    const matches = byField.get(answer.fieldId) ?? [];
    matches.push(answer);
    byField.set(answer.fieldId, matches);
  }

  return columns.flatMap((column): CsvCell[] => {
    if (column.subject !== subject || column.revisionId !== revisionId) {
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
