"use client";

import { Alert, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";

export function EventCapacity({
  snapshot,
  occupied,
}: {
  snapshot: unknown;
  occupied: number;
}) {
  const t = useTranslations("events");
  const parsed = eventSnapshotSchema.safeParse(snapshot);

  if (!parsed.success) {
    return <Alert severity="warning">{t("capacityUnavailable")}</Alert>;
  }

  const capacity = parsed.data.capacity;

  if (capacity !== null && occupied >= capacity) {
    return (
      <Alert severity="warning">
        {t("capacityFilled", { occupied, capacity, available: 0 })}{" "}
        {occupied > capacity
          ? t("capacityExceeded", { count: occupied - capacity })
          : t("allPlacesFilled")}{" "}
        {t("approvalsBlocked")}
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {capacity === null
          ? t("capacityUnlimited", { count: occupied })
          : t("capacityFilled", {
              occupied,
              capacity,
              available: capacity - occupied,
            })}
      </Typography>
      {capacity !== null && (
        <LinearProgress
          variant="determinate"
          value={(occupied / capacity) * 100}
          aria-label={t("filledPlaces")}
          aria-valuetext={t("filledPlacesValue", { occupied, capacity })}
          sx={{ height: 10, borderRadius: 0.5 }}
        />
      )}
      <Typography variant="caption" color="text.secondary">
        {t("activeOccupyPlaces")}
      </Typography>
    </Stack>
  );
}
