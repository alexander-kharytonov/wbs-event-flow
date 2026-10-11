"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { Alert, AlertTitle, Chip, Typography } from "@mui/material";
import { useFormatter, useTranslations } from "next-intl";

export function RegistrationAdmission({
  admission,
  timezone = "UTC",
  compact = false,
}: {
  admission: { createdAt: Date; revokedAt: Date | null };
  timezone?: string;
  compact?: boolean;
}) {
  const t = useTranslations("events");
  const format = useFormatter();

  return compact ? (
    <Chip
      label={
        admission.revokedAt
          ? t("registrationRevoked")
          : t("registrationConfirmed")
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
          ? t("registrationRevoked")
          : t("registrationConfirmed")}
      </AlertTitle>
      <Typography variant="body2">
        {t("admissionGrantedAt", {
          date: format.dateTime(admission.createdAt, {
            timeZone: timezone,
            dateStyle: "medium",
            timeStyle: "short",
          }),
          timezone,
        })}
      </Typography>
      {admission.revokedAt && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {t("admissionRevokedAt", {
            date: format.dateTime(admission.revokedAt, {
              timeZone: timezone,
              dateStyle: "medium",
              timeStyle: "short",
            }),
            timezone,
          })}
        </Typography>
      )}
    </Alert>
  );
}
