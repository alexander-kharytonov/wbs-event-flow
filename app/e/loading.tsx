import { Skeleton, Stack } from "@mui/material";

export default function PublicEventsLoading() {
  return (
    <Stack
      spacing={3}
      role="status"
      aria-label="Loading events"
      aria-busy="true"
    >
      <Skeleton variant="text" width="60%" height={48} />
      <Skeleton variant="rounded" height={220} />
      <Skeleton variant="rounded" height={220} />
    </Stack>
  );
}
