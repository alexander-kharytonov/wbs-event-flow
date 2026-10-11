"use client";

import { Box, Link } from "@mui/material";
import { useTranslations } from "next-intl";
import type { MouseEventHandler } from "react";

export function Logo({
  onClick,
}: {
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const t = useTranslations("shell");

  return (
    <Link
      href="/"
      aria-label={t("homeLabel")}
      underline="none"
      color="text.primary"
      variant="h6"
      onClick={onClick}
      sx={{ fontWeight: 750, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}
    >
      Event
      <Box component="span" sx={{ color: "primary.main" }}>
        {" "}
        Flow
      </Box>
      .
    </Link>
  );
}
