"use client";

import { Skeleton, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

export default function LoadingApplications() {
  const t = useTranslations("shell");

  return (
    <Stack spacing={2} aria-label={t("loadingApplications")} aria-busy="true">
      <Stack spacing={0.75}>
        <Typography variant="h5" component="div">
          <Skeleton sx={{ width: "60%", maxWidth: 240 }} />
        </Typography>
        <Typography component="div">
          <Skeleton sx={{ width: "90%", maxWidth: 640 }} />
        </Typography>
      </Stack>
      <Skeleton height={48} />
      <Skeleton variant="rounded" height={140} />
      <Skeleton variant="rounded" height={140} />
    </Stack>
  );
}
