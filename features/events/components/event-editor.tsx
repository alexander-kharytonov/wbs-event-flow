import { Alert, Stack, Typography } from "@mui/material";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { EditorNavigationGuard } from "@/components/ui/editor-navigation-guard";
import { EventText } from "@/features/events/components/event-text";
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
  duplicateFrom,
}: {
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
        initialTemplate={initialTemplate}
        duplicateError={initialTemplate ? undefined : "duplicateUnavailable"}
      />
    );
  }

  await requireOrganizer();

  return <CreateEventModes />;
}

export async function EditEventView({ eventId: id }: { eventId: string }) {
  await requireEventPermission(id, "event.edit");
  const organizer = await requireOrganizer();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
    include: {
      _count: { select: { applications: true } },
      registrationForm: {
        select: {
          _count: { select: { fields: { where: { subject: "GUEST" } } } },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const content = (
    <EditorNavigationGuard key={event.id}>
      <Stack spacing={3} sx={{ width: "100%" }}>
        <BackLink href={`/dashboard/events/${id}`}>
          <EventText id="backEvent" />
        </BackLink>
        <Stack spacing={0.75}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ overflowWrap: "anywhere" }}
          >
            {event.title}
          </Typography>
          <Typography color="text.secondary">
            <EventText id="editorEditDescription" />
          </Typography>
        </Stack>
        {workspaceReadOnly(event, new Date()) ? (
          <Alert severity="info">
            <EventText id="editorReadOnlyHint" />
          </Alert>
        ) : (
          <EventForm
            key={event.id}
            initialCover={{ assetId: event.coverAssetId, alt: event.coverAlt }}
            startLocked={eventLifecycle(event, new Date()) === "Ongoing"}
            initialValues={eventFormValues(event)}
            guestPolicyLocked={event._count.applications > 0}
            hasGuestFields={Boolean(event.registrationForm?._count.fields)}
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
    </EditorNavigationGuard>
  );

  return content;
}
