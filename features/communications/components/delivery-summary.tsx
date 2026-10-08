import { Chip, Stack } from "@mui/material";
import {
  communicationDeliverySummary,
  type DeliveryCounts,
  deliveryStatusMeaning,
} from "@/features/communications/server/history";

export const deliveryStatusColor = {
  PENDING: "warning",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "error",
} as const;

export function DeliverySummary({
  recipientCount,
  counts,
}: {
  recipientCount: number;
  counts: DeliveryCounts;
}) {
  const summary = communicationDeliverySummary(recipientCount, counts);

  return (
    <Stack spacing={1}>
      <Chip
        size="small"
        label={summary.label}
        color={summary.color}
        sx={{ alignSelf: "flex-start" }}
        aria-label={`Overall status: ${summary.label}`}
      />
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {(["PENDING", "PROCESSING", "SENT", "FAILED"] as const).map(
          (status) => (
            <Chip
              key={status}
              size="small"
              variant="outlined"
              title={deliveryStatusMeaning[status]}
              aria-label={`${status}: ${counts[status]}. ${deliveryStatusMeaning[status]}`}
              color={deliveryStatusColor[status]}
              label={`${status.charAt(0)}${status.slice(1).toLowerCase()}: ${counts[status]}`}
            />
          ),
        )}
      </Stack>
    </Stack>
  );
}
