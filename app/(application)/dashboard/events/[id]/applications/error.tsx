"use client";

import { Alert, Button, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

export default function ApplicationsError({ reset }: { reset: () => void }) {
  const t = useTranslations("events");
  const shell = useTranslations("shell");

  return (
    <Stack spacing={2}>
      <Alert severity="error">{t("applicationsLoadFailed")}</Alert>
      <Button onClick={reset} sx={{ alignSelf: "flex-start" }}>
        {shell("tryAgain")}
      </Button>
    </Stack>
  );
}
