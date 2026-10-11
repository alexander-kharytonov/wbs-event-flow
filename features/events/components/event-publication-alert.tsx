"use client";

import PublishOutlined from "@mui/icons-material/PublishOutlined";
import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { useEventPublication } from "@/features/events/use-event-publication";

export function EventPublicationAlert({
  eventId,
  contentVersion,
  label,
}: {
  eventId: string;
  contentVersion: number;
  label: string;
}) {
  const t = useTranslations("events");
  const { pending, publication, publish } = useEventPublication(
    eventId,
    contentVersion,
  );
  const changes = label === "Publish changes";

  return (
    <Alert
      severity={changes ? "warning" : "info"}
      sx={{ "& .MuiAlert-message": { width: "100%" } }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <div>
          <AlertTitle>
            {changes
              ? t("publishChangesTitle")
              : label === "Republish"
                ? t("publishUnpublishedTitle")
                : t("publishDraftTitle")}
          </AlertTitle>
          <Typography variant="body2">
            {changes ? t("publishChangesHint") : t("publishDraftHint")}
          </Typography>
          {publication.conflict && (
            <Typography variant="body2" role="alert">
              {publication.message && t(publication.message)}
            </Typography>
          )}
        </div>
        {publication.conflict ? (
          <Button
            component="a"
            href={`/dashboard/events/${eventId}`}
            sx={{ flexShrink: 0 }}
          >
            {t("eventReload")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="contained"
            startIcon={<PublishOutlined />}
            disabled={pending || Boolean(publication.success)}
            onClick={publish}
            sx={{
              flexShrink: 0,
              alignSelf: { xs: "flex-start", sm: "center" },
            }}
          >
            {pending
              ? t("publishing")
              : t(
                  changes
                    ? "publishChanges"
                    : label === "Republish"
                      ? "republish"
                      : "publish",
                )}
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
