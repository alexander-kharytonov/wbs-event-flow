import { Paper, Stack, Typography } from "@mui/material";
import { EventText } from "@/features/events/components/event-text";
import { SubmittedAnswers } from "@/features/events/components/submitted-answers";
import type { HistoricalAnswer } from "@/features/events/historical-answers";

export function SubmittedGuests({
  guests,
}: {
  guests: {
    id: string;
    name: string;
    email: string | null;
    answers: HistoricalAnswer[] | null;
  }[];
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h3">
        <EventText id="declaredGuests" />
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <EventText
          id="declaredGroupSize"
          values={{ count: guests.length + 1 }}
        />
      </Typography>
      {guests.map((guest) => (
        <Paper
          variant="outlined"
          key={guest.id}
          sx={{ p: 2, overflowWrap: "anywhere" }}
        >
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" component="h4">
              {guest.name}
            </Typography>
            {guest.email && (
              <Typography variant="body2" color="text.secondary">
                {guest.email}
              </Typography>
            )}
            <SubmittedAnswers answers={guest.answers} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
