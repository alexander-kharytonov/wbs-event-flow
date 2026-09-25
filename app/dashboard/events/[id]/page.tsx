import { Chip, Link, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { formatEventTime } from "@/features/events/format-event-time";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
  });

  if (!event) {
    notFound();
  }

  return (
    <Stack spacing={2}>
      <Link href="/dashboard">My events</Link>
      <Typography variant="h4" component="h1" sx={{ overflowWrap: "anywhere" }}>
        {event.title}
      </Typography>
      <Chip
        label={event.publishedAt ? "Published" : "Draft"}
        sx={{ alignSelf: "flex-start" }}
      />
      {event.description && (
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {event.description}
        </Typography>
      )}
      <Typography>
        Start: {formatEventTime(event.startsAt, event.timezone)}
      </Typography>
      <Typography>
        End: {formatEventTime(event.endsAt, event.timezone)}
      </Typography>
      <Typography>Timezone: {event.timezone}</Typography>
      <Typography>
        Visibility: {event.visibility === "PRIVATE" ? "Private" : "Public"}
      </Typography>
      <Typography>
        Account requirement:{" "}
        {event.accountRequirement === "OPTIONAL" ? "Optional" : "Required"}
      </Typography>
      <Typography>Guest capacity: {event.capacity ?? "No limit"}</Typography>
      {event.registrationOpensAt && (
        <Typography>
          Registration opens:{" "}
          {formatEventTime(event.registrationOpensAt, event.timezone)}
        </Typography>
      )}
      {event.registrationClosesAt && (
        <Typography>
          Registration closes:{" "}
          {formatEventTime(event.registrationClosesAt, event.timezone)}
        </Typography>
      )}
    </Stack>
  );
}
