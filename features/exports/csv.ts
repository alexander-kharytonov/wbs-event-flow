import type { Messages } from "@/lib/i18n/messages";

export const MAX_EXPORT_ROWS = 10_000;

export const MAX_EXPORT_COLUMNS = 500;

export const MAX_EXPORT_BYTES = 20 * 1024 * 1024;

export class ExportError extends Error {
  constructor(readonly code: keyof Messages["events"]) {
    super(code);
  }
}

export type CsvCell = string | number | boolean | Date | null;

// Presentation-only mitigation, deliberately separate from RFC-style quoting.
export function spreadsheetSafe(value: string) {
  if (
    /^[\s\p{Cc}\p{Cf}]*[=+@\-＝＋－＠]/u.test(value) ||
    /^[\s\p{Cc}\p{Cf}]*[\t\r\n]/u.test(value)
  ) {
    return `'${value}`;
  }

  return value;
}

export function quoteCsvCell(value: CsvCell) {
  const text =
    value === null
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  return `"${spreadsheetSafe(text).replaceAll('"', '""')}"`;
}

export function checkRowLimit(count: number) {
  if (count > MAX_EXPORT_ROWS) {
    throw new ExportError("exportRows");
  }
}

export function createCsv(headers: string[]) {
  if (headers.length > MAX_EXPORT_COLUMNS) {
    throw new ExportError("exportColumns");
  }

  const chunks: string[] = ["\uFEFF"];
  let bytes = 3;
  let rows = 0;
  const append = (cells: CsvCell[]) => {
    const record = `${cells.map(quoteCsvCell).join(",")}\r\n`;
    bytes += Buffer.byteLength(record, "utf8");

    if (bytes > MAX_EXPORT_BYTES) {
      throw new ExportError("exportBytes");
    }

    chunks.push(record);
  };
  append(headers);

  return {
    add(cells: CsvCell[]) {
      rows += 1;
      checkRowLimit(rows);

      if (cells.length !== headers.length) {
        throw new ExportError("exportFailed");
      }

      append(cells);
    },
    finish() {
      return chunks.join("");
    },
  };
}
