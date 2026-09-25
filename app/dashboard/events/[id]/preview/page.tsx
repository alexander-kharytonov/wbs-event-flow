import { Alert, Chip, Link, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { EventNavigation } from "@/features/events/components/event-navigation";
import { PublicationControls } from "@/features/events/components/publication-controls";
import { RegistrationFormPreview } from "@/features/events/components/registration-form-preview";
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import { workspaceInclude } from "@/features/events/server/publish-event";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const event = await prisma.$transaction(
    (tx) =>
      tx.event.findFirst({
        where: { id, organizerId: organizer.id },
        include: workspaceInclude,
      }),
    { isolationLevel: "RepeatableRead" },
  );

  if (!event?.registrationForm) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <Link href="/dashboard" sx={{ alignSelf: "flex-start" }}>
        My events
      </Link>
      <Typography variant="h4" component="h1">
        Event preview
      </Typography>
      <PublicationControls
        eventId={id}
        contentVersion={event.contentVersion}
        publishedRevision={event.publishedRevision}
      />
      <EventNavigation eventId={id} active="preview" />
      <Alert severity="info">
        Preview of your current workspace, including unpublished changes.
        Registration is unavailable in preview.
      </Alert>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
        <Stack
          spacing={3}
          sx={{ maxWidth: 760, mx: "auto", overflowWrap: "anywhere" }}
        >
          <Stack spacing={1}>
            <Chip
              label={
                event.visibility === "PRIVATE"
                  ? "Private · direct access"
                  : "Public"
              }
              size="small"
              sx={{ alignSelf: "flex-start" }}
            />
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontSize: { xs: "2rem", sm: "2.5rem" } }}
            >
              {event.title}
            </Typography>
            <Typography>
              {formatEventTime(event.startsAt, event.timezone)} –{" "}
              {formatEventTime(event.endsAt, event.timezone)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All times in {formatTimezone(event.timezone)}
            </Typography>
          </Stack>
          {event.description && (
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {event.description}
            </Typography>
          )}
          <Stack spacing={1}>
            <Typography variant="h6" component="h3">
              Registration
            </Typography>
            {event.registrationOpensAt && (
              <Typography>
                Opens:{" "}
                {formatEventTime(event.registrationOpensAt, event.timezone)}
              </Typography>
            )}
            {event.registrationClosesAt && (
              <Typography>
                Closes:{" "}
                {formatEventTime(event.registrationClosesAt, event.timezone)}
              </Typography>
            )}
            <Typography>
              Guest capacity: {event.capacity ?? "No limit"}
            </Typography>
            <Typography>
              Guest account{" "}
              {event.accountRequirement === "REQUIRED"
                ? "required"
                : "optional"}
            </Typography>
          </Stack>
          <RegistrationFormPreview
            fields={event.registrationForm.fields.map((field) => ({
              id: field.id,
              type: field.type,
              label: field.label,
              description: field.description,
              required: field.required,
              options: field.options.map(({ id, label }) => ({ id, label })),
            }))}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
