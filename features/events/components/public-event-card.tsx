import { Box, CardActionArea, Paper, Stack, Typography } from "@mui/material";
import { DateTime } from "@/components/ui/date-time";
import {
  EventCover,
  EventCoverBackdrop,
} from "@/features/events/components/event-cover";
import { RegistrationAvailabilityStatus } from "@/features/events/components/registration-availability-status";
import { eventCoverImage } from "@/features/events/event-cover";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function PublicEventCard({
  publicId = "",
  snapshot,
  now,
  component = "li",
  showAvailability = true,
  preview = false,
  coverBasePath,
}: {
  snapshot: EventSnapshot;
  now: Date;
  component?: "li" | "section";
  showAvailability?: boolean;
  coverBasePath?: string;
} & (
  | { preview: true; publicId?: never }
  | { preview?: false; publicId: string }
)) {
  return (
    <Paper
      component={component}
      variant="outlined"
      sx={{
        alignSelf: "stretch",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        color: snapshot.cover ? "#fff" : undefined,
      }}
    >
      <CardActionArea
        component="a"
        disabled={preview}
        href={preview ? undefined : `/e/${encodeURIComponent(publicId)}`}
        aria-labelledby={
          preview ? "preview-event-title" : `event-title-${publicId}`
        }
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflow: "hidden",
          width: "100%",
          aspectRatio: {
            xs: "auto",
            lg: snapshot.cover ? "16 / 9" : "auto",
          },
          borderRadius: "inherit",
          "& .event-cover-image": {
            transition: "transform 240ms ease",
          },
          "@media (hover: hover) and (pointer: fine)": {
            "&:hover .event-cover-image": {
              transform: "scale(1.1)",
            },
          },
          "@media (prefers-reduced-motion: reduce)": {
            "& .event-cover-image": { transition: "none" },
            "&:hover .event-cover-image": { transform: "none" },
          },
        }}
      >
        {snapshot.cover && (
          <EventCoverBackdrop>
            <EventCover
              fill
              image={{
                ...eventCoverImage(
                  snapshot.cover,
                  coverBasePath ??
                    `/e/${publicId}/cover/${snapshot.cover.assetId}`,
                ),
                sizes:
                  "(min-width: 1200px) 560px, (min-width: 600px) calc(50vw - 36px), calc(100vw - 32px)",
              }}
            />
          </EventCoverBackdrop>
        )}
        <Stack
          spacing={2}
          useFlexGap
          sx={{
            position: "relative",
            p: { xs: 2.5, sm: 4 },
            width: "100%",
            flexGrow: 1,
            alignItems: "flex-start",
            justifyContent: "flex-end",
          }}
        >
          <Typography
            id={preview ? "preview-event-title" : `event-title-${publicId}`}
            variant="h6"
            component={component === "li" ? "h3" : "h2"}
            color={snapshot.cover ? "inherit" : "primary.main"}
            sx={{ overflowWrap: "anywhere", mb: "auto" }}
          >
            {snapshot.title}
          </Typography>
          <Box>
            <DateTime
              inverse={Boolean(snapshot.cover)}
              date={snapshot.startsAt}
              endDate={snapshot.endsAt}
              timezone={snapshot.timezone}
            />
          </Box>
          {showAvailability && (
            <RegistrationAvailabilityStatus
              inverse={Boolean(snapshot.cover)}
              snapshot={snapshot}
              now={now}
            />
          )}
        </Stack>
      </CardActionArea>
    </Paper>
  );
}
