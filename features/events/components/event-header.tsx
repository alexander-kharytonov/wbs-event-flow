import { Alert, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { DateTime } from "@/components/ui/date-time";
import { EventAccessStatus } from "@/features/events/components/event-access-status";
import {
  type EventPermission,
  hasEventPermission,
} from "@/features/events/server/event-access";
import {
  type EventHeaderProjection,
  readEventHeader,
} from "@/features/events/server/event-header";
import { ExportMenu } from "@/features/exports/export-menu";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

const eventSections: {
  id:
    | "overview"
    | "registration-form"
    | "preview"
    | "staff"
    | "badges"
    | "applications"
    | "attendees"
    | "communications"
    | "check-in";
  label: string;
  permission: EventPermission;
}[] = [
  { id: "overview", label: "Overview", permission: "event.context.read" },
  {
    id: "registration-form",
    label: "Registration form",
    permission: "registrationForm.edit",
  },
  { id: "preview", label: "Preview", permission: "event.preview" },
  { id: "staff", label: "Staff", permission: "staff.manage" },
  {
    id: "applications",
    label: "Applications",
    permission: "applications.read",
  },
  {
    id: "attendees",
    label: "Attendees",
    permission: "attendees.read.reception",
  },
  { id: "badges", label: "Badges", permission: "badges.print.bulk" },
  { id: "check-in", label: "Check-in", permission: "checkIn.qr" },
  {
    id: "communications",
    label: "Communications",
    permission: "communications.read",
  },
];

import { BackLink } from "@/components/ui/back-link";
import { EventActions } from "@/features/events/components/event-actions";
import { EventCapacity } from "@/features/events/components/event-capacity";
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
    snapshot: unknown;
  } | null;
};

function OwnerEventControls({
  eventId: id,
  event,
  applicationCount,
  now,
}: {
  eventId: string;
  applicationCount: number;
  now: Date;
  event: EventHeaderData;
}) {
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
    <EventActions
      eventId={id}
      actions={actions}
      readOnly={readOnly}
      publishLabel={publishLabel}
      contentVersion={event.contentVersion}
    />
  );
}

export async function EventHeader({
  eventId,
  active,
  data: suppliedData,
  now = new Date(),
}: {
  eventId: string;
  active: ComponentProps<typeof EventNavigation>["active"];
  data?: EventHeaderProjection;
  now?: Date;
}) {
  let data = suppliedData;

  if (!data) {
    const user = await requireVerifiedUser();
    data =
      (await prisma.$transaction(
        (tx) => readEventHeader(tx, eventId, user.id),
        { isolationLevel: "RepeatableRead" },
      )) ?? undefined;
  }

  if (!data) {
    notFound();
  }

  const { context, access, ownerEvent, attendeeCount, applicationCount } = data;
  const snapshot =
    ownerEvent?.publishedRevision?.snapshot ??
    data.published?.publishedRevision?.snapshot;

  return (
    <Stack spacing={2}>
      <BackLink href="/dashboard">My events</BackLink>
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
            {context.title}
          </Typography>
          <DateTime
            date={context.startsAt}
            endDate={context.endsAt}
            timezone={context.timezone}
          />
        </Stack>
        <Stack
          direction="row"
          sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}
        >
          {hasEventPermission(access.role, "applications.read") &&
            hasEventPermission(access.role, "attendees.read.full") && (
              <ExportMenu
                eventId={eventId}
                staff={hasEventPermission(access.role, "staff.manage")}
                template={hasEventPermission(access.role, "event.edit")}
              />
            )}
          {ownerEvent && (
            <OwnerEventControls
              eventId={eventId}
              event={ownerEvent}
              applicationCount={applicationCount ?? 0}
              now={now}
            />
          )}
        </Stack>
      </Stack>
      {context.cancelledAt && (
        <Alert severity="error">
          Event cancelled.
          {ownerEvent?.cancellationReason
            ? ` ${ownerEvent.cancellationReason}`
            : ""}
        </Alert>
      )}
      {context.archivedAt && (
        <Alert severity="info">This event is archived.</Alert>
      )}
      <Stack
        direction="row"
        sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}
      >
        <EventAccessStatus role={access.role} />
        <EventLifecycleStatus event={context} now={now} />
        {ownerEvent && (
          <PublicationStatus state={publicationState(ownerEvent)} />
        )}
        {ownerEvent?.publishedRevision && (
          <PublishedVersion number={ownerEvent.publishedRevision.number} />
        )}
        {ownerEvent?.publicId && ownerEvent.publishedRevision && (
          <PublicEventLinks publicId={ownerEvent.publicId} />
        )}
      </Stack>
      {snapshot && (
        <EventCapacity snapshot={snapshot} occupied={attendeeCount} />
      )}
      <EventNavigation
        eventId={eventId}
        active={active}
        sections={eventSections
          .filter(({ permission }) =>
            hasEventPermission(access.role, permission),
          )
          .map(({ id, label }) => ({ id, label }))}
        applicationCount={applicationCount}
        attendeeCount={attendeeCount}
      />
    </Stack>
  );
}
