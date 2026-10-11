"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  date: Date | string;
  endDate?: Date | string;
  timezone: string;
  inverse?: boolean;
};

export function DateTime({ date, endDate, timezone, inverse = false }: Props) {
  const locale = useLocale();
  const t = useTranslations("shell");
  const start = new Date(date);
  const end = endDate ? new Date(endDate) : null;
  const fullDate = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const startLabel = fullDate.format(start);
  const sameDay = end !== null && fullDate.format(end) === startLabel;
  const month = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: "short",
  }).format(start);
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "numeric",
  }).format(start);

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "flex-start", minWidth: 0 }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 56,
          flexShrink: 0,
          border: 1,
          borderColor: inverse ? "rgba(255,255,255,0.3)" : "divider",
          borderRadius: 1,
          overflow: "hidden",
          textAlign: "center",
          color: inverse ? "#fff" : "primary.main",
        }}
      >
        <Box
          sx={{
            bgcolor: inverse ? "rgba(255,255,255,0.12)" : "action.hover",
            py: 0.5,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          {month.toUpperCase()}
        </Box>
        <Box
          sx={{
            py: 0.5,
            fontSize: "1.75rem",
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {day}
        </Box>
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <Typography component="div" sx={{ fontWeight: 600 }}>
          <time dateTime={start.toISOString()}>{startLabel}</time>
        </Typography>
        <Typography
          component="div"
          color={inverse ? "rgba(255,255,255,0.85)" : "text.secondary"}
        >
          {end && sameDay ? (
            t.rich("dateTimeRange", {
              startTime: time.format(start),
              endTime: time.format(end),
              start: (chunks) => (
                <time dateTime={start.toISOString()}>{chunks}</time>
              ),
              end: (chunks) => (
                <time dateTime={end.toISOString()}>{chunks}</time>
              ),
            })
          ) : (
            <time dateTime={start.toISOString()}>{time.format(start)}</time>
          )}
        </Typography>
        {end && !sameDay && (
          <Typography
            component="div"
            color={inverse ? "rgba(255,255,255,0.85)" : "text.secondary"}
          >
            {t.rich("dateTimeUntil", {
              endDate: fullDate.format(end),
              endTime: time.format(end),
              end: (chunks) => (
                <time dateTime={end.toISOString()}>{chunks}</time>
              ),
            })}
          </Typography>
        )}
        <Typography
          variant="caption"
          color={inverse ? "rgba(255,255,255,0.85)" : "text.secondary"}
        >
          {timezone.replaceAll("_", " ")}
        </Typography>
      </Stack>
    </Stack>
  );
}
