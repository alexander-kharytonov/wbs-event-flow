"use client";

import { Alert, Button, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

export default function RegistrationsError({ retry }: { retry: () => void }) {
  const t = useTranslations("shell");

  return (
    <Stack spacing={2}>
      <Alert severity="error">{t("registrationsLoadFailed")}</Alert>
      <Button onClick={retry} sx={{ alignSelf: "flex-start" }}>
        {t("tryAgain")}
      </Button>
    </Stack>
  );
}
