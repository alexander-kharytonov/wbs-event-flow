"use client";

import { Chip, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import {
  communicationDeliverySummary,
  type DeliveryCounts,
  deliveryStatusColor,
  deliveryStatusLabel,
  deliveryStatusMeaning,
} from "@/features/communications/delivery-status";

export function DeliverySummary({
  recipientCount,
  counts,
  compact = false,
}: {
  recipientCount: number;
  counts: DeliveryCounts;
  compact?: boolean;
}) {
  const t = useTranslations("events");
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
        label={t(summary.label)}
        color={summary.color}
        sx={{ alignSelf: "flex-start" }}
        aria-label={t("commOverall", { status: t(summary.label) })}
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
              title={t(deliveryStatusMeaning[status])}
              aria-label={t("commStatusAria", {
                status: t(deliveryStatusLabel[status]),
                count: counts[status],
                meaning: t(deliveryStatusMeaning[status]),
              })}
              sx={{
                color:
                  counts[status] > 0
                    ? `${deliveryStatusColor[status]}.main`
                    : "text.secondary",
                fontWeight: counts[status] > 0 ? 600 : 400,
              }}
            >
              {t("commStatusCount", {
                status: t(deliveryStatusLabel[status]),
                count: counts[status],
              })}
            </Typography>
          ) : (
            <Chip
              key={status}
              size="small"
              variant="outlined"
              title={t(deliveryStatusMeaning[status])}
              aria-label={t("commStatusAria", {
                status: t(deliveryStatusLabel[status]),
                count: counts[status],
                meaning: t(deliveryStatusMeaning[status]),
              })}
              color={deliveryStatusColor[status]}
              label={t("commStatusCount", {
                status: t(deliveryStatusLabel[status]),
                count: counts[status],
              })}
            />
          ),
        )}
      </Stack>
    </Stack>
  );
}
