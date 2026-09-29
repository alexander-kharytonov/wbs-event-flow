import { Alert, LinearProgress, Stack, Typography } from "@mui/material";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";

export function ApplicationCapacity({
  snapshot,
  occupied,
}: {
  snapshot: unknown;
  occupied: number;
}) {
  const parsed = eventSnapshotSchema.safeParse(snapshot);

  if (!parsed.success) {
    return (
      <Alert severity="warning">
        The event's capacity is unavailable. Applications cannot be approved
        until a valid event revision is published.
      </Alert>
    );
  }

  const capacity = parsed.data.capacity;

  if (capacity !== null && occupied >= capacity) {
    return (
      <Alert severity="warning">
        {occupied} of {capacity} places filled · 0 available.
        {occupied > capacity
          ? ` The event is ${occupied - capacity} over capacity. Existing registrations are kept.`
          : " All places are filled."}
        {
          " Further approvals are blocked until a place becomes available. Pending applications remain pending."
        }
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {capacity === null
          ? `${occupied} registered · Unlimited capacity`
          : `${occupied} of ${capacity} places filled · ${capacity - occupied} available`}
      </Typography>
      {capacity !== null && (
        <LinearProgress
          variant="determinate"
          value={(occupied / capacity) * 100}
          aria-label="Filled places"
          aria-valuetext={`${occupied} of ${capacity} places filled`}
          sx={{ height: 10, borderRadius: 0.5 }}
        />
      )}
      <Typography variant="caption" color="text.secondary">
        Only active registrations occupy places.
      </Typography>
    </Stack>
  );
}
