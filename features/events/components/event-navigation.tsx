import { Button, Stack } from "@mui/material";

export function EventNavigation({
  eventId,
  active,
}: {
  eventId: string;
  active: "overview" | "registration-form" | "preview";
}) {
  return (
    <Stack
      component="nav"
      aria-label="Event sections"
      direction="row"
      spacing={1}
      sx={{ borderBottom: 1, borderColor: "divider", pb: 1, flexWrap: "wrap" }}
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
    </Stack>
  );
}
