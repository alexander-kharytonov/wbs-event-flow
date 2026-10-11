"use client";

import { Paper, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

export default function PublicEventNotFound() {
  const t = useTranslations("shell");

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          {t("eventUnavailable")}
        </Typography>
        <Typography color="text.secondary">
          {t("eventUnavailableDescription")}
        </Typography>
      </Stack>
    </Paper>
  );
}
