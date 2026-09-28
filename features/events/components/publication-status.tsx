"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PendingOutlined from "@mui/icons-material/PendingOutlined";
import { Chip } from "@mui/material";
import type { publicationState } from "@/features/events/publication-state";

export function PublicationStatus({
  state,
}: {
  state: ReturnType<typeof publicationState>;
}) {
  const color =
    state === "Published" ? "success" : state === "Draft" ? "info" : "warning";
  const Icon =
    state === "Published"
      ? CheckCircleOutlined
      : state === "Draft"
        ? EditOutlined
        : PendingOutlined;

  return (
    <Chip
      label={state}
      icon={<Icon />}
      size="small"
      sx={(theme) => ({
        height: 28,
        borderRadius: 1,
        px: 1,
        bgcolor: `color-mix(in srgb, var(--mui-palette-${color}-main) 12%, var(--mui-palette-background-paper))`,
        color: `${color}.dark`,
        "& .MuiChip-icon": { color: "inherit", fontSize: 16 },
        ...theme.applyStyles("dark", { color: `${color}.light` }),
      })}
    />
  );
}
