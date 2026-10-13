"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { useEventPublication } from "@/features/events/use-event-publication";

export function EventAccessPublication({
  eventId,
  contentVersion,
  disabled,
}: {
  eventId: string;
  contentVersion: number;
  disabled: boolean;
}) {
  const t = useTranslations("events");
  const { publication, pending, publish } = useEventPublication(
    eventId,
    contentVersion,
  );

  if (publication.success) {
    return <Alert severity="success">{t("publishedSuccess")}</Alert>;
  }

  return (
    <Alert severity="warning">
      <Stack spacing={1}>
        <Typography variant="body2">{t("accessPending")}</Typography>
        {publication.message && (
          <Typography role="alert">{t(publication.message)}</Typography>
        )}
        <Button
          type="button"
          variant="contained"
          disabled={disabled || pending || Boolean(publication.conflict)}
          onClick={publish}
          sx={{ alignSelf: "flex-start" }}
        >
          {t(pending ? "publishing" : "republish")}
        </Button>
        {publication.conflict && (
          <Button component="a" href={`/dashboard/events/${eventId}/edit`}>
            {t("eventReload")}
          </Button>
        )}
        {disabled && (
          <Typography variant="caption">{t("accessSaveFirst")}</Typography>
        )}
      </Stack>
    </Alert>
  );
}
