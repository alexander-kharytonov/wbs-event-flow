"use client";

import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Chip } from "@mui/material";
import type { CommunicationKind as Kind } from "@/generated/prisma/enums";

export function CommunicationKind({ kind }: { kind: Kind }) {
  return (
    <Chip
      size="small"
      label={kind === "MANUAL" ? "Manual" : "Transactional"}
      color={kind === "MANUAL" ? "primary" : "info"}
      icon={kind === "MANUAL" ? <EditNoteOutlined /> : <SettingsOutlined />}
      variant="outlined"
      sx={{ borderRadius: 1, fontWeight: 600, alignSelf: "center" }}
    />
  );
}
