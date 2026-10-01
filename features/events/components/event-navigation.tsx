import { Badge, Button, Stack } from "@mui/material";

type Section =
  | "overview"
  | "registration-form"
  | "preview"
  | "staff"
  | "applications"
  | "attendees"
  | "check-in";

export function EventNavigation({
  eventId,
  active,
  sections,
  applicationCount,
  attendeeCount,
}: {
  eventId: string;
  active: Section;
  sections: { id: Section; label: string }[];
  applicationCount?: number;
  attendeeCount: number;
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
        "& .MuiButton-root": { flexShrink: 0 },
        "& [aria-current=page]": {
          bgcolor: "action.selected",
          boxShadow: "inset 0 -2px var(--mui-palette-primary-main)",
        },
      }}
    >
      {sections.map(({ id, label }) => {
        const count =
          id === "applications"
            ? applicationCount
            : id === "attendees"
              ? attendeeCount
              : undefined;

        return (
          <Button
            key={id}
            href={`/dashboard/events/${eventId}${id === "overview" ? "" : `/${id}`}`}
            color={active === id ? "primary" : "inherit"}
            aria-current={active === id ? "page" : undefined}
            aria-label={count === undefined ? label : `${label} (${count})`}
            sx={{ pr: count === undefined ? undefined : 3 }}
          >
            {count === undefined ? (
              label
            ) : (
              <Badge
                badgeContent={count}
                color="primary"
                showZero
                sx={{ "& .MuiBadge-badge": { right: -12 } }}
              >
                {label}
              </Badge>
            )}
          </Button>
        );
      })}
    </Stack>
  );
}
