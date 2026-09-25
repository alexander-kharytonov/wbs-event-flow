import { Paper, Skeleton, Stack } from "@mui/material";

export default function LoadingRegistrationForm() {
  return (
    <Stack spacing={3} aria-label="Loading registration form" aria-busy="true">
      <Skeleton width={100} />
      <Skeleton variant="text" width="60%" height={48} />
      <Skeleton width={260} height={44} />
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Skeleton width={150} height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </Stack>
      </Paper>
      <Skeleton width={200} height={40} />
      <Skeleton variant="rounded" height={140} />
    </Stack>
  );
}
