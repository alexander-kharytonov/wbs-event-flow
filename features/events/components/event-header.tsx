import { Alert, Link, Stack, Typography } from "@mui/material";
import type { ComponentProps } from "react";
import { EventActions } from "@/features/events/components/event-actions";
import { EventLifecycleStatus } from "@/features/events/components/event-lifecycle-status";
import { EventNavigation } from "@/features/events/components/event-navigation";
import { PublicEventLinks } from "@/features/events/components/public-event-links";
import { PublicationStatus } from "@/features/events/components/publication-status";
import {
  type EventLifecycleData,
  eventLifecycle,
  workspaceReadOnly,
} from "@/features/events/event-lifecycle";
import { publicationState } from "@/features/events/publication-state";

type EventHeaderData = EventLifecycleData & {
  cancellationReason: string | null;
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
  actions = [],
}: {
  actions?: ComponentProps<typeof EventActions>["actions"];
  eventId: string;
  applicationCount: number;
  event: EventHeaderData;
  active: ComponentProps<typeof EventNavigation>["active"];
}) {
  const now = new Date();
  const readOnly = workspaceReadOnly(event, now);
  const state = publicationState(event);
  const lifecycle = eventLifecycle(event, now);
  const canPublish =
    !readOnly &&
    state !== "Published" &&
    (lifecycle === "Upcoming" || Boolean(event.publicId));
  const publishLabel = !canPublish
    ? null
    : event.publishedRevision
      ? "Publish changes"
      : event.publicId
        ? "Republish"
        : "Publish";

  return (
    <Stack spacing={2}>
      <Link
        href={event.archivedAt ? "/dashboard/archived" : "/dashboard"}
        sx={{ alignSelf: "flex-start" }}
      >
        {event.archivedAt ? "← Archived events" : "← My events"}
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
          <Stack
            direction="row"
            sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            <EventLifecycleStatus event={event} now={now} />
            <PublicationStatus state={state} />
            {event.publishedRevision?.number && (
              <Typography variant="body2" color="text.secondary">
                Revision {event.publishedRevision.number}
              </Typography>
            )}
            {event.publicId && event.publishedRevision && (
              <PublicEventLinks publicId={event.publicId} />
            )}
          </Stack>
        </Stack>
        <EventActions
          eventId={id}
          actions={actions}
          readOnly={readOnly}
          publishLabel={publishLabel}
          contentVersion={event.contentVersion}
        />
      </Stack>
      {event.cancelledAt && (
        <Alert
          severity="error"
          sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          Event cancelled. {event.cancellationReason}
        </Alert>
      )}
      {readOnly && !event.cancelledAt && (
        <Alert severity="info">This event workspace is read-only.</Alert>
      )}
      {!readOnly && !event.publicId && lifecycle === "Ongoing" && (
        <Alert severity="info">
          This event has already started. First publication is only available
          before the event starts.
        </Alert>
      )}
      <EventNavigation
        eventId={id}
        active={active}
        applicationCount={applicationCount}
      />
    </Stack>
  );
}
