"use client";

import { Button, Paper, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

export function NotFoundContent() {
  const t = useTranslations("shell");

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, sm: 5 },
        maxWidth: 480,
        width: "100%",
        mx: "auto",
        my: "auto",
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h1" color="text.secondary">
          404
        </Typography>
        <Typography component="h2" variant="h4" align="center">
          {t("pageNotFound")}
        </Typography>
        <Typography color="text.secondary" align="center">
          {t("pageNotFoundDescription")}
        </Typography>
        <Button href="/" variant="contained">
          {t("backHome")}
        </Button>
      </Stack>
    </Paper>
  );
}
