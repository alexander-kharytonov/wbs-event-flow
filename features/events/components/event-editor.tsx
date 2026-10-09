import { Alert, Stack, Typography } from "@mui/material";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { EventFormDialog } from "@/features/events/components/event-form-dialog";
import { EventForm } from "@/features/events/event-form";
import {
  eventDateSource,
  eventFormValues,
} from "@/features/events/event-form-values";
import {
  eventLifecycle,
  workspaceReadOnly,
} from "@/features/events/event-lifecycle";
import { CreateEventModes } from "@/features/events/import/create-event-modes";
import {
  type TemplateEvent,
  validateTemplateCreate,
} from "@/features/events/import/template-input";
import { requireEventPermission } from "@/features/events/server/require-event-permission";
import { updateEvent } from "@/features/events/update-event";
import {
  EventTemplateError,
  serializeEventTemplate,
} from "@/features/exports/event-template";
import { readEventTemplate } from "@/features/exports/server/event-template";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function CreateEventView({
  modal = false,
  duplicateFrom,
}: {
  modal?: boolean;
  duplicateFrom?: string | string[];
}) {
  if (duplicateFrom !== undefined) {
    let initialTemplate: TemplateEvent | undefined;
    let failure: "authorization" | "configuration" | "unavailable" | undefined;

    try {
      const session = await auth.api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true, disableRefresh: true },
      });

      if (
        typeof duplicateFrom !== "string" ||
        !session?.user.emailVerified ||
        session.session.expiresAt.getTime() <= Date.now()
      ) {
        failure = "authorization";
      } else {
        const template = await readEventTemplate(
          session.user.id,
          duplicateFrom,
        );

        if (!template) {
          failure = "authorization";
        } else {
          // Enforce export byte semantics on the valid source before the review title.
          serializeEventTemplate(template);
          const parsed = validateTemplateCreate(template);

          if (parsed.success) {
            initialTemplate = {
              ...parsed.template.event,
              title: `${parsed.template.event.title} (Copy)`,
            };
          } else {
            failure = "configuration";
          }
        }
      }
    } catch (error) {
      // A failed read is not evidence of revoked access. Never expose raw errors.
      failure =
        error instanceof EventTemplateError ? "configuration" : "unavailable";
    }
    const sourceKey =
      typeof duplicateFrom === "string" ? duplicateFrom : "invalid";
    // Confirmed server denial discards the entire protected client subtree.
    // Configuration/unknown failures keep its identity and already-loaded snapshot.
    const reviewKey = `${sourceKey}:${failure === "authorization" ? "denied" : "review"}`;

    return (
      <CreateEventModes
        key={reviewKey}
        modal={modal}
        initialTemplate={initialTemplate}
        duplicateError={
          initialTemplate
            ? undefined
            : "This event cannot be duplicated. Check your access and whether its configuration meets template limits and its badge design matches the current form."
        }
      />
    );
  }

  await requireOrganizer();

  return <CreateEventModes modal={modal} />;
}

export async function EditEventView({
  eventId: id,
  modal = false,
}: {
  eventId: string;
  modal?: boolean;
}) {
  await requireEventPermission(id, "event.edit");
  const organizer = await requireOrganizer();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
  });

  if (!event) {
    notFound();
  }

  const content = (
    <Stack spacing={3} sx={{ width: "100%" }}>
      {!modal && (
        <BackLink href={`/dashboard/events/${id}`}>Back to event</BackLink>
      )}
      {!modal && (
        <Typography
          variant="h4"
          component="h1"
          sx={{ overflowWrap: "anywhere" }}
        >
          {event.title}
        </Typography>
      )}
      {workspaceReadOnly(event, new Date()) ? (
        <Alert severity="info">
          This event is read-only. Its information and history remain available.
        </Alert>
      ) : (
        <EventForm
          initialCover={{ assetId: event.coverAssetId, alt: event.coverAlt }}
          startLocked={eventLifecycle(event, new Date()) === "Ongoing"}
          initialValues={eventFormValues(event)}
          serverAction={updateEvent}
          edit={{
            id: event.id,
            dates: eventDateSource(event),
            version: Buffer.from(event.updatedAt.toISOString()).toString(
              "base64url",
            ),
          }}
        />
      )}
    </Stack>
  );

  return modal ? (
    <EventFormDialog title={event.title}>{content}</EventFormDialog>
  ) : (
    content
  );
}
