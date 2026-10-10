import { Box, Stack, Typography } from "@mui/material";

type Props = {
  date: Date | string;
  endDate?: Date | string;
  timezone: string;
  inverse?: boolean;
};

export function DateTime({ date, endDate, timezone, inverse = false }: Props) {
  const start = new Date(date);
  const end = endDate ? new Date(endDate) : null;
  const fullDate = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const startLabel = fullDate.format(start);
  const sameDay = end !== null && fullDate.format(end) === startLabel;
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
  }).format(start);
  const day = new Intl.DateTimeFormat("en-US", {
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
          {time.format(start)}
          {end && sameDay && (
            <>
              {" "}
              – <time dateTime={end.toISOString()}>{time.format(end)}</time>
            </>
          )}
        </Typography>
        {end && !sameDay && (
          <Typography
            component="div"
            color={inverse ? "rgba(255,255,255,0.85)" : "text.secondary"}
          >
            Until{" "}
            <time dateTime={end.toISOString()}>
              {fullDate.format(end)}, {time.format(end)}
            </time>
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
