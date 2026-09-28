"use client";

import { Chip } from "@mui/material";
import type { ReactElement } from "react";

export function EventStatusChip({
  label,
  icon,
  color,
}: {
  label: string;
  icon: ReactElement;
  color: "success" | "info" | "warning" | "error" | "default";
}) {
  return (
    <Chip
      label={label}
      icon={icon}
      size="small"
      sx={(theme) => ({
        height: 28,
        borderRadius: 1,
        px: 1,
        bgcolor:
          color === "default"
            ? "action.selected"
            : `color-mix(in srgb, var(--mui-palette-${color}-main) 12%, var(--mui-palette-background-paper))`,
        color: color === "default" ? "text.secondary" : `${color}.dark`,
        "& .MuiChip-icon": { color: "inherit", fontSize: 16 },
        ...theme.applyStyles("dark", {
          color: color === "default" ? "text.secondary" : `${color}.light`,
        }),
      })}
    />
  );
}
