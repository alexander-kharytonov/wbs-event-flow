import { Skeleton, Stack } from "@mui/material";

export default function LoadingRegistrations() {
  return (
    <Stack spacing={2} aria-label="Loading registrations" aria-busy="true">
      <Skeleton width="45%" height={48} />
      <Skeleton height={48} />
      <Skeleton variant="rounded" height={240} />
      <Skeleton variant="rounded" height={240} />
    </Stack>
  );
}
