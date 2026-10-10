import { Box, Link, Stack, Typography } from "@mui/material";
import { EventDescription } from "@/features/events/components/event-description";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

// Presentation only: the caller authorizes and chooses draft or published data.
export function EventRichContent({ snapshot }: { snapshot: EventSnapshot }) {
  const location = snapshot.location;
  const schedule = snapshot.schedule;
  const publicOrganizer = snapshot.publicOrganizer;
  const dayFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: snapshot.timezone,
    dateStyle: "full",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: snapshot.timezone,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  const days = new Map<
    string,
    { entry: (typeof schedule)[number]; index: number }[]
  >();

  for (const [index, entry] of schedule.entries()) {
    const day = dayFormatter.format(new Date(entry.startsAt));
    const entries = days.get(day) ?? [];
    entries.push({ entry, index });
    days.set(day, entries);
  }

  return (
    <Stack
      spacing={4}
      sx={{ "&:empty": { display: "none" }, maxWidth: "75ch" }}
    >
      {snapshot.description && (
        <Stack
          component="section"
          aria-labelledby="event-description-title"
          spacing={2}
        >
          <Typography id="event-description-title" variant="h5" component="h2">
            About this event
          </Typography>
          <EventDescription
            text={snapshot.description}
            format={snapshot.descriptionFormat}
          />
        </Stack>
      )}
      {location && (
        <Stack
          component="section"
          aria-labelledby="event-location-title"
          spacing={1}
        >
          <Typography id="event-location-title" variant="h5" component="h2">
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
        <Stack
          component="section"
          aria-labelledby="event-schedule-title"
          spacing={2}
        >
          <Typography id="event-schedule-title" variant="h5" component="h2">
            Schedule
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All times in {snapshot.timezone}.
          </Typography>
          {[...days].map(([day, entries]) => (
            <Stack key={day} spacing={1.5}>
              <Typography component="h3" variant="subtitle1">
                {day}
              </Typography>
              <Box component="ol" sx={{ listStyle: "none", p: 0, m: 0 }}>
                {entries.map(({ entry, index }) => (
                  <Box
                    component="li"
                    key={`${index}:${entry.startsAt}`}
                    sx={{
                      py: 2,
                      borderTop: 1,
                      borderColor: "divider",
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "140px minmax(0, 1fr)",
                      },
                      gap: 1,
                    }}
                  >
                    <Typography
                      component="time"
                      dateTime={entry.startsAt}
                      variant="body2"
                      color="text.secondary"
                    >
                      {timeFormatter.format(new Date(entry.startsAt))}
                    </Typography>
                    <Box>
                      <Typography component="h4" variant="subtitle1">
                        {entry.title}
                      </Typography>
                      {entry.description && (
                        <Typography sx={{ whiteSpace: "pre-wrap" }}>
                          {entry.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
      {publicOrganizer && (
        <Stack
          component="section"
          aria-labelledby="event-organizer-title"
          spacing={1}
        >
          <Typography id="event-organizer-title" variant="h5" component="h2">
            Organizer
          </Typography>
          <Typography variant="subtitle1" component="p">
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
