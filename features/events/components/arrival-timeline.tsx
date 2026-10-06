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
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const peak = peakArrival(buckets);
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  const label = (instant: string) => format.format(new Date(instant));
  const range = (bucket: ArrivalBucket) =>
    `${label(bucket.start)} – ${label(bucket.end)}`;
  const step =
    stepMinutes < 60
      ? `${stepMinutes} minutes`
      : `${stepMinutes / 60} ${stepMinutes === 60 ? "hour" : "hours"}`;

  if (!peak) {
    return (
      <Stack spacing={1}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
          Arrivals over time
        </Typography>
        <Typography color="text.secondary">
          No arrivals recorded for active attendees yet.
        </Typography>
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
        Arrivals over time
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {total} active attendees checked in · {step} intervals · {timezone}
      </Typography>
      <Box
        component="svg"
        viewBox={`0 0 ${width} 230`}
        role="img"
        aria-label={`Arrivals over time: ${total} check-ins. Highest interval: ${range(peak)}, ${peak.count} attendees. Full values in the table below.`}
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
        <title>Arrivals over time</title>
        <line x1={left} y1={baseline} x2={width - 12} y2={baseline} />
        <text x={left - 8} y={baseline} textAnchor="end">
          0
        </text>
        <text x={left - 8} y={24} textAnchor="end">
          {max}
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
                  {`${range(bucket)}: ${bucket.count}${bucket.incomplete ? " (in progress)" : ""}`}
                </title>
              </rect>
              {index % labelEvery === 0 && (
                <text x={x} y={201} textAnchor="start">
                  <tspan x={x}>{label(bucket.start).split(", ")[0]}</tspan>
                  <tspan x={x} dy={16}>
                    {label(bucket.start).split(", ").slice(1).join(", ")}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
      </Box>
      <Typography variant="body2">
        <Box component="span" sx={{ fontWeight: 600 }}>
          {ongoing ? "Peak so far" : "Peak arrival"}
        </Box>
        {` · ${range(peak)} · ${peak.count} attendees${peak.incomplete ? " · interval in progress" : ""}`}
      </Typography>
      {buckets.some((bucket) => bucket.incomplete) && (
        <Typography variant="caption" color="text.secondary">
          The lighter bar is the current, incomplete interval.
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
        <summary>View interval values</summary>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table
            size="small"
            stickyHeader
            aria-label={`Arrival intervals in ${timezone}`}
          >
            <TableHead>
              <TableRow>
                <TableCell>Interval ({timezone})</TableCell>
                <TableCell align="right">Attendees</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buckets.map((bucket) => (
                <TableRow key={bucket.start}>
                  <TableCell component="th" scope="row">
                    {range(bucket)}
                  </TableCell>
                  <TableCell align="right">{bucket.count}</TableCell>
                  <TableCell>
                    {bucket.incomplete ? "In progress" : "Complete"}
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
