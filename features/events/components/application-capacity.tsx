import { Alert, LinearProgress, Stack, Typography } from "@mui/material";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";

export function ApplicationCapacity({
  snapshot,
  approved,
}: {
  snapshot: unknown;
  approved: number;
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

  if (capacity !== null && approved >= capacity) {
    return (
      <Alert severity="warning">
        {approved} of {capacity} places filled · 0 available.
        {approved > capacity
          ? ` The event is ${approved - capacity} over capacity. Existing approvals are kept.`
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
          ? `${approved} approved · Unlimited capacity`
          : `${approved} of ${capacity} places filled · ${capacity - approved} available`}
      </Typography>
      {capacity !== null && (
        <LinearProgress
          variant="determinate"
          value={(approved / capacity) * 100}
          aria-label="Filled places"
          aria-valuetext={`${approved} of ${capacity} places filled`}
          sx={{ height: 10, borderRadius: 0.5 }}
        />
      )}
      <Typography variant="caption" color="text.secondary">
        Only approved applications occupy places.
      </Typography>
    </Stack>
  );
}
