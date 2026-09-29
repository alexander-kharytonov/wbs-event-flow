"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { Chip, Stack, Typography } from "@mui/material";
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
  const status = (
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
  );

  if (compact) {
    return status;
  }

  return (
    <Stack spacing={1}>
      {status}
      <Typography variant="body2" color="text.secondary">
        Granted {formatEventTime(admission.createdAt, timezone)} ({timezone})
      </Typography>
      {admission.revokedAt && (
        <Typography variant="body2" color="text.secondary">
          Revoked {formatEventTime(admission.revokedAt, timezone)} ({timezone})
        </Typography>
      )}
    </Stack>
  );
}
