"use client";

import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  type ArrivalBucket,
  peakArrival,
} from "@/features/events/overview-timeline";

export function ArrivalTimeline({
  buckets,
  stepMinutes,
  timezone,
  ongoing,
}: {
  buckets: ArrivalBucket[];
  stepMinutes: number;
  timezone: string;
  ongoing: boolean;
}) {
  const t = useTranslations("events");
  const formatter = useFormatter();
  const locale = useLocale();
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const peak = peakArrival(buckets);
  const dateOptions = {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  } as const;
  const timeOptions = {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  } as const;
  const dateFormat = new Intl.DateTimeFormat(locale, dateOptions);
  const timeFormat = new Intl.DateTimeFormat(locale, timeOptions);
  const fullFormat = new Intl.DateTimeFormat(locale, {
    ...dateOptions,
    ...timeOptions,
  });
  const label = (instant: string) => fullFormat.format(new Date(instant));
  const range = (bucket: ArrivalBucket) =>
    t("arrivalsRange", { start: label(bucket.start), end: label(bucket.end) });
  const step =
    stepMinutes < 60
      ? t("arrivalsMinutes", { count: stepMinutes })
      : t("arrivalsHours", { count: stepMinutes / 60 });

  if (!peak) {
    return (
      <Stack spacing={1}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t("arrivalsTitle")}
        </Typography>
        <Typography color="text.secondary">{t("arrivalsEmpty")}</Typography>
      </Stack>
    );
  }

  const width = 760;
  const left = 42;
  const plotWidth = width - left - 12;
  const baseline = 180;
  const barWidth = plotWidth / buckets.length;
  const max = peak.count;
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 4));

  return (
    <Stack spacing={1.5}>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t("arrivalsTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("arrivalsSummary", { count: total, step, timezone })}
      </Typography>
      <Box
        component="svg"
        viewBox={`0 0 ${width} 230`}
        role="img"
        aria-label={t("arrivalsAria", {
          total,
          range: range(peak),
          count: peak.count,
        })}
        sx={{
          width: "100%",
          height: "auto",
          display: "block",
          color: "primary.main",
          "& text": {
            color: "text.secondary",
            fill: "currentColor",
            fontSize: 12,
          },
          "& line": { color: "divider", stroke: "currentColor" },
        }}
      >
        <title>{t("arrivalsTitle")}</title>
        <line x1={left} y1={baseline} x2={width - 12} y2={baseline} />
        <text x={left - 8} y={baseline} textAnchor="end">
          0
        </text>
        <text x={left - 8} y={24} textAnchor="end">
          {formatter.number(max)}
        </text>
        {buckets.map((bucket, index) => {
          const height = (bucket.count / max) * 156;
          const x = left + index * barWidth;

          return (
            <g key={bucket.start}>
              <rect
                x={x + 1}
                y={baseline - height}
                width={Math.max(1, barWidth - 2)}
                height={height}
                fill="currentColor"
                opacity={bucket.incomplete ? 0.5 : 1}
              >
                <title>
                  {t("arrivalsBucket", {
                    range: range(bucket),
                    count: bucket.count,
                    incomplete: bucket.incomplete ? "yes" : "no",
                  })}
                </title>
              </rect>
              {index % labelEvery === 0 && (
                <text x={x} y={201} textAnchor="start">
                  <tspan x={x}>
                    {dateFormat.format(new Date(bucket.start))}
                  </tspan>
                  <tspan x={x} dy={16}>
                    {timeFormat.format(new Date(bucket.start))}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
      </Box>
      <Typography variant="body2">
        <Box component="span" sx={{ fontWeight: 600 }}>
          {ongoing ? t("arrivalsPeakSoFar") : t("arrivalsPeak")}
        </Box>
        {t("arrivalsPeakDetail", {
          range: range(peak),
          count: peak.count,
          incomplete: peak.incomplete ? "yes" : "no",
        })}
      </Typography>
      {buckets.some((bucket) => bucket.incomplete) && (
        <Typography variant="caption" color="text.secondary">
          {t("arrivalsLightBar")}
        </Typography>
      )}
      <Box
        component="details"
        sx={{
          "& summary": {
            cursor: "pointer",
            color: "text.secondary",
            typography: "body2",
            py: 1,
          },
        }}
      >
        <summary>{t("arrivalsValues")}</summary>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table
            size="small"
            stickyHeader
            aria-label={t("arrivalsTableAria", { timezone })}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t("arrivalsInterval", { timezone })}</TableCell>
                <TableCell align="right">{t("attendees")}</TableCell>
                <TableCell>{t("status")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buckets.map((bucket) => (
                <TableRow key={bucket.start}>
                  <TableCell component="th" scope="row">
                    {range(bucket)}
                  </TableCell>
                  <TableCell align="right">
                    {formatter.number(bucket.count)}
                  </TableCell>
                  <TableCell>
                    {bucket.incomplete
                      ? t("arrivalsProgress")
                      : t("arrivalsComplete")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Stack>
  );
}
