import type { EmailOutboxStatus } from "@/generated/prisma/enums";
import type { Messages } from "@/lib/i18n/messages";

export const deliveryStatusMeaning = {
  PENDING: "commPendingMeaning",
  PROCESSING: "commProcessingMeaning",
  SENT: "commSentMeaning",
  FAILED: "commFailedMeaning",
} as const satisfies Record<EmailOutboxStatus, string>;

export type DeliveryCounts = Record<EmailOutboxStatus, number>;

export function communicationDeliverySummary(
  recipientCount: number,
  counts: DeliveryCounts,
): {
  label: keyof Messages["events"];
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
    return { label: "commStatusUnavailable", color: "default" };
  }

  if (recipientCount === 0) {
    return { label: "commNoRecipients", color: "default" };
  }

  if (counts.SENT === recipientCount) {
    return { label: "commSent", color: "success" };
  }

  if (counts.FAILED === recipientCount) {
    return { label: "commFailed", color: "error" };
  }

  if (counts.FAILED > 0) {
    return {
      label:
        counts.PENDING + counts.PROCESSING > 0
          ? "commPartial"
          : "commCompletedFailures",
      color: "warning",
    };
  }

  if (counts.PENDING === recipientCount) {
    return { label: "commPending", color: "default" };
  }

  return { label: "commInProgress", color: "info" };
}

export const deliveryStatusColor = {
  PENDING: "warning",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "error",
} as const;

export const deliveryStatusLabel = {
  PENDING: "commPending",
  PROCESSING: "commProcessing",
  SENT: "commSent",
  FAILED: "commFailed",
} as const;
