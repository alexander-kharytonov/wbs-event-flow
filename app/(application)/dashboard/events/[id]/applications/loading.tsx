import { Skeleton, Stack } from "@mui/material";

export default function LoadingApplications() {
  return (
    <Stack spacing={2} aria-label="Loading applications" aria-busy="true">
      <Skeleton width="45%" height={48} />
      <Skeleton height={48} />
      <Skeleton variant="rounded" height={140} />
      <Skeleton variant="rounded" height={140} />
    </Stack>
  );
}
