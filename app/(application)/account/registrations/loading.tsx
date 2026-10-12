"use client";

import { Box, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("shell");

  return (
    <Stack
      spacing={3}
      role="status"
      aria-label={t("loadingRegistrations")}
      aria-busy="true"
    >
      <Stack spacing={0.75}>
        <Typography variant="h5" component="div">
          <Skeleton sx={{ width: "60%", maxWidth: 240 }} />
        </Typography>
        <Typography color="text.secondary" component="div">
          <Skeleton sx={{ width: "90%", maxWidth: 640 }} />
        </Typography>
      </Stack>
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
