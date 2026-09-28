import CancelOutlined from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import PendingOutlined from "@mui/icons-material/PendingOutlined";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import { Chip } from "@mui/material";
import type { ApplicationStatus as Status } from "@/generated/prisma/enums";

export const applicationStatusLabels = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function ApplicationStatus({ status }: { status: Status }) {
  return (
    <Chip
      size="small"
      label={applicationStatusLabels[status]}
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
      variant="filled"
      sx={{ borderRadius: 1, fontWeight: 600 }}
    />
  );
}
