"use client";

import { Skeleton, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

export default function LoadingCommunications() {
  const t = useTranslations("shell");

  return (
    <Stack spacing={2} aria-label={t("loadingCommunications")} aria-busy="true">
      <Skeleton width="45%" height={48} />
      <Skeleton height={48} />
      <Skeleton variant="rounded" height={360} />
      <Skeleton variant="rounded" height={140} />
    </Stack>
  );
}
