import { Skeleton, Stack } from "@mui/material";

export default function LoadingCommunications() {
  return (
    <Stack spacing={2} aria-label="Loading communications" aria-busy="true">
      <Skeleton width="45%" height={48} />
      <Skeleton height={48} />
      <Skeleton variant="rounded" height={360} />
      <Skeleton variant="rounded" height={140} />
    </Stack>
  );
}
