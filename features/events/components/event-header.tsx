import EditOutlined from "@mui/icons-material/EditOutlined";
import { Button, Link, Stack, Typography } from "@mui/material";
import type { ComponentProps } from "react";
import { EventNavigation } from "@/features/events/components/event-navigation";
import { PublicationControls } from "@/features/events/components/publication-controls";

type EventHeaderData = {
  title: string;
  contentVersion: number;
  publicId: string | null;
  publishedRevision: { contentVersion: number; number?: number } | null;
};

export function EventHeader({
  eventId: id,
  event,
  active,
  applicationCount,
}: {
  eventId: string;
  applicationCount: number;
  event: EventHeaderData;
  active: ComponentProps<typeof EventNavigation>["active"];
}) {
  return (
    <Stack spacing={3}>
      <Link href="/dashboard" sx={{ alignSelf: "flex-start" }}>
        My events
      </Link>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ overflowWrap: "anywhere" }}
          >
            {event.title}
          </Typography>
          <PublicationControls
            eventId={id}
            contentVersion={event.contentVersion}
            publishedRevision={event.publishedRevision}
            publicId={event.publicId}
          />
        </Stack>
        <Button
          href={`/dashboard/events/${id}/edit`}
          variant="contained"
          startIcon={<EditOutlined />}
          sx={{ flexShrink: 0, alignSelf: "flex-start" }}
        >
          Edit event
        </Button>
      </Stack>
      <EventNavigation
        eventId={id}
        active={active}
        applicationCount={applicationCount}
      />
    </Stack>
  );
}
