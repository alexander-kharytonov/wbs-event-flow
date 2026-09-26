import { Alert, Typography } from "@mui/material";
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
        Published capacity is unavailable. Applications cannot be approved until
        a valid event revision is published.
      </Alert>
    );
  }

  const capacity = parsed.data.capacity;

  if (capacity !== null && approved >= capacity) {
    return (
      <Alert severity="warning">
        {approved} approved · Published capacity: {capacity}.
        {approved > capacity
          ? " The event is over capacity. Existing approvals are kept."
          : " All places are filled."}
        {
          " Further approvals are blocked while published capacity is reached. Pending applications remain pending."
        }
      </Alert>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      {approved} approved · Published capacity:{" "}
      {capacity === null ? "Unlimited" : capacity}
    </Typography>
  );
}
