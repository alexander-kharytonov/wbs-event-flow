import { Chip, Stack, Typography } from "@mui/material";
import {
  communicationDeliverySummary,
  type DeliveryCounts,
  deliveryStatusMeaning,
} from "@/features/communications/delivery-status";

export const deliveryStatusColor = {
  PENDING: "warning",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "error",
} as const;

export function DeliverySummary({
  recipientCount,
  counts,
  compact = false,
}: {
  recipientCount: number;
  counts: DeliveryCounts;
  compact?: boolean;
}) {
  const summary = communicationDeliverySummary(recipientCount, counts);

  return (
    <Stack
      direction={compact ? { xs: "column", sm: "row" } : "column"}
      sx={{
        gap: compact ? 1.5 : 1,
        alignItems: compact ? { sm: "center" } : undefined,
      }}
    >
      <Chip
        size="small"
        label={summary.label}
        color={summary.color}
        sx={{ alignSelf: "flex-start" }}
        aria-label={`Overall status: ${summary.label}`}
      />
      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", columnGap: compact ? 2 : 1, rowGap: 0.75 }}
      >
        {(["PENDING", "PROCESSING", "SENT", "FAILED"] as const).map((status) =>
          compact ? (
            <Typography
              key={status}
              variant="caption"
              title={deliveryStatusMeaning[status]}
              aria-label={`${status}: ${counts[status]}. ${deliveryStatusMeaning[status]}`}
              sx={{
                color:
                  counts[status] > 0
                    ? `${deliveryStatusColor[status]}.main`
                    : "text.secondary",
                fontWeight: counts[status] > 0 ? 600 : 400,
              }}
            >
              {status.charAt(0)}
              {status.slice(1).toLowerCase()}: {counts[status]}
            </Typography>
          ) : (
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
