import { Alert, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EventCover } from "@/features/events/components/event-cover";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { EventHeader } from "@/features/events/components/event-header";
import { EventPreviewTabs } from "@/features/events/components/event-preview-tabs";
import { PublicEventCard } from "@/features/events/components/public-event-card";
import { RegistrationApplicationForm } from "@/features/events/components/registration-application-form";
import { eventCoverImage } from "@/features/events/event-cover";
import {
  buildEventSnapshot,
  workspaceInclude,
} from "@/features/events/server/build-event-snapshot";
import { requireEventPermission } from "@/features/events/server/require-event-permission";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireEventPermission(id, "event.preview");
  const organizer = await requireOrganizer();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const event = await prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: { id, organizerId: organizer.id },
        include: {
          registrationForm: workspaceInclude.registrationForm,
        },
      });

      if (!event) {
        return null;
      }

      // Read sibling relations sequentially on the transaction's connection.
      const coverAsset = event.coverAssetId
        ? await tx.mediaAsset.findUnique({
            where: { id: event.coverAssetId },
            select: workspaceInclude.coverAsset.select,
          })
        : null;

      return { ...event, coverAsset };
    },
    { isolationLevel: "RepeatableRead" },
  );

  if (!event?.registrationForm) {
    notFound();
  }

  const snapshot = buildEventSnapshot(event);

  const now = new Date();

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="preview" contentPadding={false}>
        {snapshot.success ? (
          <EventPreviewTabs
            landing={
              <Paper
                elevation={0}
                sx={{ bgcolor: "background.default", p: { xs: 2, sm: 4 } }}
              >
                <EventGuestView
                  snapshot={snapshot.data}
                  now={now}
                  cover={
                    snapshot.data.cover && (
                      <EventCover
                        fill
                        priority
                        key={snapshot.data.cover.assetId}
                        image={eventCoverImage(
                          snapshot.data.cover,
                          `/api/events/${id}/cover/${snapshot.data.cover.assetId}`,
                        )}
                      />
                    )
                  }
                />
              </Paper>
            }
            registration={
              <Paper
                elevation={0}
                sx={{ bgcolor: "background.default", p: { xs: 2, sm: 4 } }}
              >
                <Stack spacing={3}>
                  <Typography component="h2" variant="h4">
                    Register to attend
                  </Typography>
                  <RegistrationApplicationForm
                    key={`registration-preview:${id}`}
                    preview
                    fields={snapshot.data.registrationForm.fields}
                    eventContext={
                      <PublicEventCard
                        preview
                        snapshot={snapshot.data}
                        now={now}
                        component="section"
                        coverBasePath={
                          snapshot.data.cover
                            ? `/api/events/${id}/cover/${snapshot.data.cover.assetId}`
                            : undefined
                        }
                      />
                    }
                  />
                </Stack>
              </Paper>
            }
          />
        ) : (
          <Alert severity="error" sx={{ m: { xs: 2, sm: 4 } }}>
            Check the event details and registration questions before
            previewing.
          </Alert>
        )}
      </EventHeader>
    </Stack>
  );
}
