"use client";

import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Chip } from "@mui/material";
import { useTranslations } from "next-intl";
import type { CommunicationKind as Kind } from "@/generated/prisma/enums";

export function CommunicationKind({ kind }: { kind: Kind }) {
  const t = useTranslations("events");

  return (
    <Chip
      size="small"
      label={kind === "MANUAL" ? t("commManual") : t("commTransactional")}
      color={kind === "MANUAL" ? "primary" : "info"}
      icon={kind === "MANUAL" ? <EditNoteOutlined /> : <SettingsOutlined />}
      variant="outlined"
      sx={{ borderRadius: 1, fontWeight: 600, alignSelf: "center" }}
    />
  );
}
