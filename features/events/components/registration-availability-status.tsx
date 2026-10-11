"use client";

import { Chip, Stack, Typography } from "@mui/material";
import { useFormatter, useTranslations } from "next-intl";
import { formatTimezone } from "@/features/events/format-timezone";
import {
  registrationAvailability,
  registrationDeadline,
} from "@/features/events/registration-availability";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function RegistrationAvailabilityStatus({
  snapshot,
  now,
  inverse = false,
}: {
  snapshot: Pick<
    EventSnapshot,
    "endsAt" | "registrationOpensAt" | "registrationClosesAt" | "timezone"
  >;
  now: Date;
  inverse?: boolean;
}) {
  const t = useTranslations("events");
  const format = useFormatter();
  const status = registrationAvailability(snapshot, now);
  const labels = {
    OPEN: "registrationOpen",
    NOT_OPEN_YET: "registrationNotOpen",
    CLOSED: "registrationClosed",
  } as const;
  const boundary =
    status === "NOT_OPEN_YET"
      ? snapshot.registrationOpensAt
      : registrationDeadline(snapshot);
  const timing =
    status === "NOT_OPEN_YET"
      ? "registrationOpensAt"
      : status === "OPEN"
        ? "registrationClosesAt"
        : "registrationClosedAt";

  return (
    <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
      <Chip
        label={t(labels[status])}
        color={
          status === "OPEN"
            ? "success"
            : status === "NOT_OPEN_YET"
              ? "info"
              : "default"
        }
        size="small"
        variant="outlined"
        sx={
          inverse
            ? { color: "#fff", borderColor: "rgba(255,255,255,0.5)" }
            : undefined
        }
      />
      {boundary && (
        <Typography
          variant="body2"
          color={inverse ? "rgba(255,255,255,0.85)" : "text.secondary"}
          sx={{ overflowWrap: "anywhere" }}
        >
          {t(timing, {
            date: format.dateTime(new Date(boundary), {
              timeZone: snapshot.timezone,
              dateStyle: "medium",
              timeStyle: "short",
            }),
            timezone: formatTimezone(snapshot.timezone),
          })}
        </Typography>
      )}
    </Stack>
  );
}
