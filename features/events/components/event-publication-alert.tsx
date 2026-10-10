"use client";

import PublishOutlined from "@mui/icons-material/PublishOutlined";
import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
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
              ? "You have unpublished changes"
              : label === "Republish"
                ? "This event is unpublished"
                : "Your event is a draft"}
          </AlertTitle>
          <Typography variant="body2">
            {changes
              ? "Publish your saved changes to update the event page for attendees."
              : "Review your event, then publish it to make its page available to attendees."}
          </Typography>
          {publication.conflict && (
            <Typography variant="body2" role="alert">
              {publication.message}
            </Typography>
          )}
        </div>
        {publication.conflict ? (
          <Button
            component="a"
            href={`/dashboard/events/${eventId}`}
            sx={{ flexShrink: 0 }}
          >
            Reload event
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
            {pending ? "Publishing…" : label}
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
