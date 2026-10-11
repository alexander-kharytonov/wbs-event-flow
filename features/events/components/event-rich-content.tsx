import Timeline from "@mui/lab/Timeline";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineOppositeContent from "@mui/lab/TimelineOppositeContent";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import { Stack, Typography } from "@mui/material";
import { EventDescription } from "@/features/events/components/event-description";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

// Presentation only: the caller authorizes and chooses draft or published data.
export function EventRichContent({ snapshot }: { snapshot: EventSnapshot }) {
  const schedule = snapshot.schedule;

  if (!snapshot.description && schedule.length === 0) {
    return null;
  }
  const dayFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: snapshot.timezone,
    dateStyle: "full",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: snapshot.timezone,
    hour: "2-digit",
    minute: "2-digit",
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
              <Timeline sx={{ p: 0, m: 0 }}>
                {entries.map(({ entry, index }, position) => (
                  <TimelineItem
                    key={`${index}:${entry.startsAt}`}
                    sx={{ minHeight: 0 }}
                  >
                    <TimelineOppositeContent
                      sx={{
                        flex: { xs: "0 0 76px", sm: "0 0 112px" },
                        pt: 0.25,
                        pl: 0,
                        pr: { xs: 1.5, sm: 2 },
                      }}
                    >
                      <Typography
                        component="time"
                        dateTime={entry.startsAt}
                        variant="body2"
                        color="primary.main"
                        sx={{ fontWeight: 600 }}
                      >
                        {timeFormatter.format(new Date(entry.startsAt))}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot
                        color="primary"
                        variant="outlined"
                        sx={{ my: 0.75, boxShadow: "none" }}
                      />
                      {position < entries.length - 1 && (
                        <TimelineConnector sx={{ bgcolor: "divider" }} />
                      )}
                    </TimelineSeparator>
                    <TimelineContent
                      sx={{
                        pt: 0,
                        pb: position < entries.length - 1 ? 3.5 : 0,
                        pl: 2,
                        pr: 0,
                        minWidth: 0,
                      }}
                    >
                      <Typography component="h4" variant="subtitle1">
                        {entry.title}
                      </Typography>
                      {entry.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}
                        >
                          {entry.description}
                        </Typography>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
