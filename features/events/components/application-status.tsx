import { Chip } from "@mui/material";
import type { ApplicationStatus as Status } from "@/generated/prisma/enums";

export const applicationStatusLabels = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
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
            : "warning"
      }
      variant="outlined"
    />
  );
}
