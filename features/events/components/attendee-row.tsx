import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import RadioButtonUncheckedOutlined from "@mui/icons-material/RadioButtonUncheckedOutlined";
import {
  Avatar,
  Box,
  Chip,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import type { OrganizerAttendee } from "@/features/events/server/organizer-attendees";

export function AttendeeRow({
  person,
  active,
  contextOnly = false,
  onSelect,
}: {
  person: OrganizerAttendee;
  active: boolean;
  contextOnly?: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("events");
  const nameParts = person.name.trim().split(/\s+/u).filter(Boolean);
  const initials = [
    nameParts[0],
    ...(nameParts.length > 1 ? [nameParts[nameParts.length - 1]] : []),
  ]
    .map((part) => Array.from(part ?? "")[0] ?? "")
    .join("")
    .toUpperCase();
  let colorHash = 0;

  for (const character of initials) {
    colorHash = (colorHash * 31 + (character.codePointAt(0) ?? 0)) % 360;
  }

  return (
    <ListItemButton
      onClick={() => onSelect(person.id)}
      aria-label={t("attendeeOpen", { name: person.name })}
      aria-haspopup="dialog"
      alignItems="flex-start"
      sx={{
        px: { xs: 2, sm: 3 },
        py: 2,
        ...(contextOnly ? { bgcolor: "action.hover" } : {}),
        gap: { xs: 1.5, sm: 2 },
        minWidth: 0,
      }}
    >
      <ListItemAvatar sx={{ minWidth: 0, mt: 0.5 }}>
        <Avatar
          sx={{
            bgcolor: `hsl(${colorHash}, 55%, 32%)`,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {initials}
        </Avatar>
      </ListItemAvatar>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          alignItems: { md: "center" },
        }}
      >
        <ListItemText
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}
          primary={person.name}
          secondary={
            <>
              {person.email && (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    display: "block",
                    color: "text.primary",
                    mt: 0.25,
                  }}
                >
                  {person.email}
                </Typography>
              )}
              <Typography
                component="span"
                variant="caption"
                sx={{ display: "block", mt: 0.5 }}
              >
                {person.kind === "GUEST" ? t("guest") : t("primaryAttendee")}
                {person.ticket ? ` · ${person.ticket.number}` : ""}
                {contextOnly ? ` · ${t("attendeeContext")}` : ""}
              </Typography>
            </>
          }
          slotProps={{
            primary: {
              component: "div",
              sx: { fontWeight: 600 },
            },
            secondary: { component: "div" },
          }}
        />
        <Stack
          direction="row"
          useFlexGap
          spacing={1.5}
          sx={{
            alignItems: "center",
            flexWrap: "wrap",
            flexShrink: 0,
            maxWidth: "100%",
          }}
        >
          <Chip
            size="small"
            variant="outlined"
            label={active ? t("active") : t("attendeeRevoked")}
            color={active ? "success" : "default"}
            icon={active ? <CheckCircleOutlined /> : <BlockOutlined />}
            sx={{ borderRadius: 1, fontWeight: 600 }}
          />
          <Chip
            size="small"
            variant="outlined"
            label={person.attendance ? t("checkedIn") : t("attendeeNotChecked")}
            color={person.attendance ? "success" : "default"}
            icon={
              person.attendance ? (
                <HowToRegOutlined />
              ) : (
                <RadioButtonUncheckedOutlined />
              )
            }
            sx={{ borderRadius: 1, fontWeight: 600 }}
          />
        </Stack>
      </Box>
    </ListItemButton>
  );
}
