"use client";

import { Alert, Button, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

export default function PublicEventsError({ reset }: { reset: () => void }) {
  const t = useTranslations("shell");

  return (
    <Stack spacing={2}>
      <Alert severity="error">{t("eventLoadFailed")}</Alert>
      <Button onClick={reset} sx={{ alignSelf: "flex-start" }}>
        {t("tryAgain")}
      </Button>
    </Stack>
  );
}
