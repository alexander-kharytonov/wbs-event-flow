import { Alert, Stack, Typography } from "@mui/material";
import type { ComponentProps } from "react";
import { BackLink } from "@/components/ui/back-link";
import { EventActions } from "@/features/events/components/event-actions";
import { EventLifecycleStatus } from "@/features/events/components/event-lifecycle-status";
import { EventNavigation } from "@/features/events/components/event-navigation";
import { PublicEventLinks } from "@/features/events/components/public-event-links";
import { PublicationStatus } from "@/features/events/components/publication-status";
import { PublishedVersion } from "@/features/events/components/published-version";
import {
  type EventLifecycleData,
  eventLifecycle,
  workspaceReadOnly,
} from "@/features/events/event-lifecycle";
import { publicationState } from "@/features/events/publication-state";
import { eventSnapshotV1Schema } from "@/features/events/schemas/event-snapshot";

type EventHeaderData = EventLifecycleData & {
  cancellationReason: string | null;
  title: string;
  contentVersion: number;
  publicId: string | null;
  publishedAt: Date | null;
  _count: { revisions: number };
  publishedRevision: {
    contentVersion: number;
    number?: number;
    snapshot?: unknown;
  } | null;
};

export function EventHeader({
  eventId: id,
  event,
  active,
  applicationCount,
  attendeeCount,
}: {
  eventId: string;
  applicationCount: number;
  attendeeCount: number;
  event: EventHeaderData;
  active: ComponentProps<typeof EventNavigation>["active"];
}) {
  const now = new Date();
  const readOnly = workspaceReadOnly(event, now);
  const state = publicationState(event);
  const lifecycle = eventLifecycle(event, now);
  const canPublish =
    !readOnly &&
    (state !== "Published" ||
      eventSnapshotV1Schema.safeParse(event.publishedRevision?.snapshot)
        .success) &&
    (lifecycle === "Upcoming" || Boolean(event.publicId));
  const publishLabel = !canPublish
    ? null
    : event.publishedRevision
      ? "Publish changes"
      : event.publicId
        ? "Republish"
        : "Publish";

  const actions: ("cancel" | "unpublish" | "archive" | "restore" | "delete")[] =
    [];

  if (event.archivedAt) {
    actions.push("restore");
  } else {
    if (!event.cancelledAt && event.publishedRevision) {
      actions.push("unpublish");
    }

    if (lifecycle === "Cancelled" || lifecycle === "Completed") {
      actions.push("archive");
    }

    if (
      !event.cancelledAt &&
      lifecycle !== "Completed" &&
      event._count.revisions > 0
    ) {
      actions.push("cancel");
    }

    if (
      !event.cancelledAt &&
      !event.publicId &&
      !event.publishedAt &&
      event._count.revisions === 0 &&
      applicationCount === 0
    ) {
      actions.push("delete");
    }
  }

  return (
    <Stack spacing={2}>
      <BackLink href={event.archivedAt ? "/dashboard/archived" : "/dashboard"}>
        {event.archivedAt ? "Archived events" : "My events"}
      </BackLink>
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
              <PublishedVersion number={event.publishedRevision.number} />
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
        attendeeCount={attendeeCount}
      />
    </Stack>
  );
}
