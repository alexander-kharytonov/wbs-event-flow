import { Badge, Button, Stack } from "@mui/material";

export function EventNavigation({
  eventId,
  active,
  applicationCount,
  attendeeCount,
}: {
  eventId: string;
  applicationCount: number;
  attendeeCount: number;
  active:
    | "overview"
    | "registration-form"
    | "preview"
    | "applications"
    | "attendees"
    | "check-in";
}) {
  return (
    <Stack
      component="nav"
      aria-label="Event sections"
      direction="row"
      useFlexGap
      spacing={1}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        pb: 1,
        flexWrap: "wrap",
        "& .MuiButton-root": { flexShrink: 0, whiteSpace: "nowrap" },
        "& [aria-current=page]": {
          bgcolor: "action.selected",
          boxShadow: "inset 0 -2px var(--mui-palette-primary-main)",
          fontWeight: 700,
        },
      }}
    >
      <Button
        href={`/dashboard/events/${eventId}`}
        color={active === "overview" ? "primary" : "inherit"}
        aria-current={active === "overview" ? "page" : undefined}
      >
        Overview
      </Button>
      <Button
        href={`/dashboard/events/${eventId}/registration-form`}
        color={active === "registration-form" ? "primary" : "inherit"}
        aria-current={active === "registration-form" ? "page" : undefined}
      >
        Registration form
      </Button>
      <Button
        href={`/dashboard/events/${eventId}/preview`}
        color={active === "preview" ? "primary" : "inherit"}
        aria-current={active === "preview" ? "page" : undefined}
      >
        Preview
      </Button>
      <Button
        href={`/dashboard/events/${eventId}/applications`}
        color={active === "applications" ? "primary" : "inherit"}
        aria-current={active === "applications" ? "page" : undefined}
        aria-label={`Applications (${applicationCount})`}
        sx={{ pr: 3 }}
      >
        <Badge
          badgeContent={applicationCount}
          color="primary"
          showZero
          sx={{ "& .MuiBadge-badge": { right: -12 } }}
        >
          Applications
        </Badge>
      </Button>
      <Button
        href={`/dashboard/events/${eventId}/attendees`}
        color={active === "attendees" ? "primary" : "inherit"}
        aria-current={active === "attendees" ? "page" : undefined}
        aria-label={`Attendees (${attendeeCount})`}
        sx={{ pr: 3 }}
      >
        <Badge
          badgeContent={attendeeCount}
          color="primary"
          showZero
          sx={{ "& .MuiBadge-badge": { right: -12 } }}
        >
          Attendees
        </Badge>
      </Button>
      <Button
        href={`/dashboard/events/${eventId}/check-in`}
        color={active === "check-in" ? "primary" : "inherit"}
        aria-current={active === "check-in" ? "page" : undefined}
      >
        Check-in
      </Button>
    </Stack>
  );
}
