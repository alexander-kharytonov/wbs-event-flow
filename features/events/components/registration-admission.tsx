"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { Alert, AlertTitle, Chip, Typography } from "@mui/material";
import { formatEventTime } from "@/features/events/format-event-time";

export function RegistrationAdmission({
  admission,
  timezone = "UTC",
  compact = false,
}: {
  admission: { createdAt: Date; revokedAt: Date | null };
  timezone?: string;
  compact?: boolean;
}) {
  return compact ? (
    <Chip
      label={
        admission.revokedAt ? "Registration revoked" : "Registration confirmed"
      }
      color={admission.revokedAt ? "default" : "success"}
      icon={admission.revokedAt ? undefined : <CheckCircleOutlined />}
      size="small"
      variant="outlined"
      sx={{ alignSelf: "flex-start" }}
    />
  ) : (
    <Alert severity={admission.revokedAt ? "info" : "success"}>
      <AlertTitle>
        {admission.revokedAt
          ? "Registration revoked"
          : "Registration confirmed"}
      </AlertTitle>
      <Typography variant="body2">
        Granted {formatEventTime(admission.createdAt, timezone)} ({timezone})
      </Typography>
      {admission.revokedAt && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Revoked {formatEventTime(admission.revokedAt, timezone)} ({timezone})
        </Typography>
      )}
    </Alert>
  );
}
