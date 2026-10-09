import { Box, Link, Stack, Typography } from "@mui/material";
import type { z } from "zod";
import { EventDescription } from "@/features/events/components/event-description";
import { formatEventTime } from "@/features/events/format-event-time";
import type { eventSnapshotV3Schema } from "@/features/events/schemas/event-snapshot";

// OWNER Preview supplies a current workspace snapshot. No storage locator crosses this boundary.
export function EventRichPreview({
  snapshot,
  eventId,
}: {
  snapshot: z.infer<typeof eventSnapshotV3Schema>;
  eventId: string;
}) {
  const { cover, location, schedule, publicOrganizer } = snapshot;

  return (
    <Stack spacing={3}>
      {cover && (
        <Box
          component="img"
          src={`/api/events/${eventId}/cover/${cover.assetId}/1280`}
          alt={cover.alt ?? ""}
          width={cover.variants["1280"].width}
          height={cover.variants["1280"].height}
          sx={{
            width: "100%",
            height: "auto",
            maxHeight: 480,
            objectFit: "contain",
            borderRadius: 1,
          }}
        />
      )}
      {snapshot.description && (
        <EventDescription
          text={snapshot.description}
          format={snapshot.descriptionFormat}
        />
      )}
      {location && (
        <Stack component="section" spacing={1}>
          <Typography variant="h6" component="h2">
            Location
          </Typography>
          {"venueName" in location && (
            <>
              <Typography sx={{ fontWeight: 600 }}>
                {location.venueName}
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }}>
                {location.address}
              </Typography>
            </>
          )}
          {"onlineUrl" in location && (
            <Link
              component="a"
              href={location.onlineUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {location.onlineLabel}
            </Link>
          )}
        </Stack>
      )}
      {schedule.length > 0 && (
        <Stack component="section" spacing={1}>
          <Typography variant="h6" component="h2">
            Agenda
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All times in {snapshot.timezone}.
          </Typography>
          <Box component="ol" sx={{ pl: 3, m: 0 }}>
            {schedule.map((entry, index) => (
              <Box
                component="li"
                // biome-ignore lint/suspicious/noArrayIndexKey: Immutable server preview has no row state; identical entries are allowed.
                key={`${index}:${entry.startsAt}`}
                sx={{ mb: 2 }}
              >
                <Typography component="h3" variant="subtitle1">
                  {entry.title}
                </Typography>
                <Typography
                  component="time"
                  dateTime={entry.startsAt}
                  variant="body2"
                  color="text.secondary"
                >
                  {formatEventTime(new Date(entry.startsAt), snapshot.timezone)}
                </Typography>
                {entry.description && (
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>
                    {entry.description}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Stack>
      )}
      {publicOrganizer && (
        <Stack component="section" spacing={1}>
          <Typography variant="h6" component="h2">
            Organizer
          </Typography>
          <Typography variant="subtitle1">
            {publicOrganizer.displayName}
          </Typography>
          {publicOrganizer.description && (
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {publicOrganizer.description}
            </Typography>
          )}
          {publicOrganizer.websiteUrl && (
            <Link
              component="a"
              href={publicOrganizer.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Organizer website
            </Link>
          )}
        </Stack>
      )}
    </Stack>
  );
}
