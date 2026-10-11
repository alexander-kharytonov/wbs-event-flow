"use client";

import { ListItemButton } from "@mui/material";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function ApplicationListItemButton({
  href,
  fullName,
  children,
}: {
  href: string;
  fullName: string;
  children: ReactNode;
}) {
  const t = useTranslations("events");

  return (
    <ListItemButton
      component={NextLink}
      href={href}
      scroll={false}
      aria-label={t("applicationOpen", { name: fullName })}
      alignItems="flex-start"
      sx={{
        px: { xs: 2, sm: 3 },
        py: 2.5,
        gap: { xs: 1.5, sm: 2 },
        minWidth: 0,
      }}
    >
      {children}
    </ListItemButton>
  );
}
