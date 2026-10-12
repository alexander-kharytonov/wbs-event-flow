"use client";

import { Skeleton, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

export default function LoadingCommunications() {
  const t = useTranslations("shell");

  return (
    <Stack spacing={2} aria-label={t("loadingCommunications")} aria-busy="true">
      <Stack direction="row" spacing={2}>
        <Skeleton width={180} height={56} />
        <Skeleton width={200} height={56} />
      </Stack>
      <Skeleton width="90%" />
      <Skeleton height={48} />
      <Skeleton variant="rounded" height={360} />
    </Stack>
  );
}
