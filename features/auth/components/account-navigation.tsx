import { Button, Stack } from "@mui/material";

const sections = [
  { id: "overview", label: "Overview", href: "/account" },
  {
    id: "registrations",
    label: "Registrations",
    href: "/account/registrations",
  },
  { id: "profile", label: "Profile", href: "/account/profile" },
] as const;

export function AccountNavigation({
  active,
}: {
  active: (typeof sections)[number]["id"];
}) {
  return (
    <Stack
      component="nav"
      aria-label="Account sections"
      direction="row"
      sx={{
        gap: 1,
        borderBottom: 1,
        borderColor: "divider",
        pb: 1,
        overflowX: "auto",
        "& .MuiButton-root": { flexShrink: 0 },
        "& [aria-current=page]": {
          bgcolor: "action.selected",
          fontWeight: 700,
        },
      }}
    >
      {sections.map(({ id, label, href }) => (
        <Button
          key={id}
          href={href}
          variant="text"
          color={active === id ? "primary" : "inherit"}
          aria-current={active === id ? "page" : undefined}
          sx={{ px: 1.5 }}
        >
          {label}
        </Button>
      ))}
    </Stack>
  );
}
