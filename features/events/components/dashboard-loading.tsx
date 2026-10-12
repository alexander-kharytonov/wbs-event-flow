"use client";

import { Box, Skeleton, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

export function DashboardLoading() {
  const t = useTranslations("shell");

  return (
    <Stack spacing={3} aria-label={t("loadingEvents")} aria-busy="true">
      <Skeleton height={48} width="60%" />
      <Skeleton height={36} width="80%" />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <Skeleton variant="rounded" height={160} />
        <Skeleton variant="rounded" height={160} />
      </Box>
    </Stack>
  );
}
