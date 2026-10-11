"use client";

import CancelOutlined from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import PendingOutlined from "@mui/icons-material/PendingOutlined";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import { Chip } from "@mui/material";
import { useTranslations } from "next-intl";
import type { ApplicationStatus as Status } from "@/generated/prisma/enums";

export function ApplicationStatus({ status }: { status: Status }) {
  const t = useTranslations("events");

  return (
    <Chip
      size="small"
      label={t(
        (
          {
            PENDING: "pending",
            APPROVED: "approved",
            REJECTED: "rejected",
            WITHDRAWN: "withdrawn",
          } as const
        )[status],
      )}
      color={
        status === "APPROVED"
          ? "success"
          : status === "REJECTED"
            ? "error"
            : status === "WITHDRAWN"
              ? "default"
              : "warning"
      }
      icon={
        status === "APPROVED" ? (
          <CheckCircleOutlined />
        ) : status === "REJECTED" ? (
          <CancelOutlined />
        ) : status === "WITHDRAWN" ? (
          <UndoOutlined />
        ) : (
          <PendingOutlined />
        )
      }
      variant="outlined"
      sx={{ borderRadius: 1, fontWeight: 600 }}
    />
  );
}
