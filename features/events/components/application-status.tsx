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
      variant="outlined"
    />
  );
}
