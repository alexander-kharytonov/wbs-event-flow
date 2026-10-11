"use client";

import Login from "@mui/icons-material/Login";
import { Box, Button } from "@mui/material";
import { useTranslations } from "next-intl";

export function SignInLink() {
  const t = useTranslations("shell");

  return (
    <Button
      href="/sign-in"
      variant="outlined"
      aria-label={t("signIn")}
      sx={{
        minWidth: { xs: 44, sm: 64 },
        px: { xs: 1, sm: 2.25 },
        flexShrink: 0,
      }}
    >
      <Login fontSize="small" sx={{ display: { xs: "block", sm: "none" } }} />
      <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
        {t("signIn")}
      </Box>
    </Button>
  );
}
