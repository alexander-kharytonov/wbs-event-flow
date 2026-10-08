import type { EmailOutboxStatus } from "@/generated/prisma/enums";

export const deliveryStatusMeaning = {
  PENDING: "Queued / awaiting attempt",
  PROCESSING: "Currently claimed",
  SENT: "SMTP transport accepted",
  FAILED: "Automatic attempts exhausted",
} as const satisfies Record<EmailOutboxStatus, string>;

export type DeliveryCounts = Record<EmailOutboxStatus, number>;

export function communicationDeliverySummary(
  recipientCount: number,
  counts: DeliveryCounts,
): {
  label: string;
  color: "default" | "info" | "success" | "warning" | "error";
} {
  const values = [
    counts.PENDING,
    counts.PROCESSING,
    counts.SENT,
    counts.FAILED,
  ];
  const total = values.reduce((sum, count) => sum + count, 0);

  if (
    !Number.isSafeInteger(recipientCount) ||
    recipientCount < 0 ||
    values.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    total !== recipientCount
  ) {
    return { label: "Status unavailable", color: "default" };
  }

  if (recipientCount === 0) {
    return { label: "No recipients", color: "default" };
  }

  if (counts.SENT === recipientCount) {
    return { label: "Sent", color: "success" };
  }

  if (counts.FAILED === recipientCount) {
    return { label: "Failed", color: "error" };
  }

  if (counts.FAILED > 0) {
    return {
      label:
        counts.PENDING + counts.PROCESSING > 0
          ? "In progress · partial failures"
          : "Completed with failures",
      color: "warning",
    };
  }

  if (counts.PENDING === recipientCount) {
    return { label: "Pending", color: "default" };
  }

  return { label: "In progress", color: "info" };
}
