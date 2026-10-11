"use client";

import { Box, Link } from "@mui/material";
import { useTranslations } from "next-intl";
import type { MouseEventHandler } from "react";
import { LogoMark } from "@/components/ui/logo-mark";

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
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        flexShrink: 0,
        fontWeight: 750,
        letterSpacing: "-0.04em",
        whiteSpace: "nowrap",
        "@media (max-width: 359.95px)": {
          gap: 0.75,
          fontSize: 14,
          "& .MuiSvgIcon-root": { fontSize: 16 },
        },
      }}
    >
      <LogoMark color="primary" sx={{ fontSize: 24 }} />
      <Box component="span">
        Event
        <Box component="span" sx={{ color: "primary.main" }}>
          {" "}
          Flow
        </Box>
        .
      </Box>
    </Link>
  );
}
