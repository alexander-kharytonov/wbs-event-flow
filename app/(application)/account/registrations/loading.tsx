import { Box, Paper, Skeleton, Stack } from "@mui/material";

export default function Loading() {
  return (
    <Stack
      spacing={3}
      role="status"
      aria-label="Loading registrations"
      aria-busy="true"
    >
      <Skeleton width="45%" height={48} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2,
        }}
      >
        {[0, 1].map((item) => (
          <Paper key={item} variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Skeleton width="25%" />
              <Skeleton width="80%" height={36} />
              <Skeleton width="65%" />
              <Skeleton width="45%" />
              <Skeleton variant="rounded" width={150} height={40} />
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
