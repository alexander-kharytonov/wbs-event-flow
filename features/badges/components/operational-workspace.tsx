"use client";

import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MAX_BADGES_PER_DOCUMENT,
  nextBadgeBatchUrl,
} from "@/features/badges/print-request";
import type { readBadgeWorkspace } from "@/features/badges/server/bulk";
import { EventAccessStatus } from "@/features/events/components/event-access-status";

type Workspace = NonNullable<Awaited<ReturnType<typeof readBadgeWorkspace>>>;

function BadgePersonContent({
  name,
  role,
  secondary,
}: {
  name: string;
  role: ReactNode;
  secondary?: string;
}) {
  const nameParts = name.trim().split(/\s+/u).filter(Boolean);
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
    <>
      <ListItemAvatar sx={{ minWidth: 0 }}>
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
          primary={name}
          secondary={secondary}
          slotProps={{
            primary: { component: "div", sx: { fontWeight: 600 } },
            secondary: { component: "div", sx: { mt: 0.5 } },
          }}
        />
        <Box
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "center" } }}
        >
          {role}
        </Box>
      </Box>
    </>
  );
}

export function OperationalBadgeWorkspace({
  eventId,
  data,
  designer,
}: {
  eventId: string;
  data: Workspace;
  designer: ReactNode;
}) {
  const [section, setSection] = useState(
    data.configure ? "design" : "attendees",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const visible = data.attendees.filter((attendee) =>
    attendee.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const selectedSet = new Set(selected);
  const validSelection =
    selected.length > 0 && selected.length <= MAX_BADGES_PER_DOCUMENT;

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  return (
    <Stack spacing={3}>
      <Tabs
        value={section}
        onChange={(_, value) => setSection(value)}
        aria-label="Badge workspace sections"
      >
        {data.configure && (
          <Tab
            value="design"
            label="Design"
            id="badge-design-tab"
            aria-controls="badge-design-panel"
          />
        )}
        <Tab
          value="team"
          label="Staff"
          id="badge-team-tab"
          aria-controls="badge-team-panel"
        />
        <Tab
          value="attendees"
          label="Attendees"
          id="badge-attendees-tab"
          aria-controls="badge-attendees-panel"
        />
      </Tabs>
      {data.configure && (
        <Box
          hidden={section !== "design"}
          role="tabpanel"
          id="badge-design-panel"
          aria-labelledby="badge-design-tab"
        >
          {designer}
        </Box>
      )}
      {section !== "design" && (
        <Alert severity="info">
          Printing always uses the current saved badge design. Unsaved Designer
          changes are not printed.
        </Alert>
      )}
      {data.cancelled && section !== "design" && (
        <Alert severity="info">
          Printing is unavailable for a cancelled event.
        </Alert>
      )}
      {section === "attendees" && (
        <Stack
          spacing={2}
          role="tabpanel"
          id="badge-attendees-panel"
          aria-labelledby="badge-attendees-tab"
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            <TextField
              label="Search attendees"
              placeholder="Name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ minWidth: 0 }}
            />
          </Box>
          <Box
            component="form"
            noValidate
            method="post"
            target="_blank"
            rel="noopener"
            action={`/print/events/${eventId}/badges/bulk`}
            onSubmit={(event) => {
              if (!validSelection || data.cancelled) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="mode" value="SELECTED" />
            {selected.map((id) => (
              <input key={id} type="hidden" name="attendeeId" value={id} />
            ))}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              <Button
                type="submit"
                variant="contained"
                startIcon={<PrintOutlined />}
                disabled={!validSelection || data.cancelled}
              >
                Print selected
              </Button>
              <Typography variant="body2">
                {selected.length} / {MAX_BADGES_PER_DOCUMENT} selected
              </Typography>
              <Button
                disabled={!selected.length}
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
              <Button
                disabled={
                  !visible.length ||
                  new Set([...selected, ...visible.map((person) => person.id)])
                    .size > MAX_BADGES_PER_DOCUMENT
                }
                onClick={() =>
                  setSelected([
                    ...new Set([
                      ...selected,
                      ...visible.map((person) => person.id),
                    ]),
                  ])
                }
              >
                Select visible
              </Button>
            </Stack>
          </Box>
          {visible.length ? (
            <Paper variant="outlined" sx={{ maxHeight: 480, overflow: "auto" }}>
              <List disablePadding aria-label="Badge attendees">
                {visible.map((attendee, index) => (
                  <ListItem
                    key={attendee.id}
                    disablePadding
                    divider={index < visible.length - 1}
                  >
                    <ListItemButton
                      role="checkbox"
                      aria-checked={selectedSet.has(attendee.id)}
                      aria-label={`Select ${attendee.name}`}
                      disabled={
                        !selectedSet.has(attendee.id) &&
                        selected.length >= MAX_BADGES_PER_DOCUMENT
                      }
                      onClick={() =>
                        toggle(attendee.id, !selectedSet.has(attendee.id))
                      }
                      alignItems="center"
                      sx={{
                        px: { xs: 2, sm: 3 },
                        py: 2.5,
                        gap: { xs: 1.5, sm: 2 },
                        minWidth: 0,
                      }}
                    >
                      <Checkbox
                        checked={selectedSet.has(attendee.id)}
                        tabIndex={-1}
                        disableRipple
                        slotProps={{ input: { "aria-hidden": true } }}
                        sx={{ pointerEvents: "none", p: 0 }}
                      />
                      <BadgePersonContent
                        name={attendee.name}
                        role={
                          <Chip
                            label={
                              attendee.kind === "GUEST" ? "Guest" : "Primary"
                            }
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: 1, fontWeight: 600 }}
                          />
                        }
                        secondary={
                          attendee.kind === "GUEST" &&
                          attendee.primaryAttendeeName !== null
                            ? `Guest of ${attendee.primaryAttendeeName}`
                            : undefined
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          ) : (
            <EmptyState
              icon={<PeopleOutlined />}
              title={
                data.attendees.length
                  ? "No matching attendees"
                  : "No active attendees"
              }
              description={
                data.attendees.length
                  ? "Try another search."
                  : "No active attendees are available."
              }
            />
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Typography variant="subtitle1">All active attendees</Typography>
              <Typography variant="body2" color="text.secondary">
                Print up to 200 current active attendees, including guests.
                Search and selection do not limit this action. If more are
                available, use Print next batch in the opened document. Every
                batch checks current data.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PrintOutlined />}
                href={nextBadgeBatchUrl(eventId)}
                target="_blank"
                rel="noopener noreferrer"
                disabled={data.cancelled || !data.attendees.length}
              >
                Print all active
              </Button>
            </Stack>
          </Paper>
        </Stack>
      )}
      {section === "team" && (
        <Stack
          spacing={2}
          role="tabpanel"
          id="badge-team-panel"
          aria-labelledby="badge-team-tab"
        >
          <Alert severity="info">
            Visual badges for the current event team: name and role, with the
            event name when enabled. No Ticket, QR or registration answers.
          </Alert>
          {data.teamTooLarge ? (
            <Alert severity="info">
              This event team is too large to print in one document.
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <List disablePadding aria-label="Badge event team">
                {data.team.map((person, index) => (
                  <ListItem
                    // biome-ignore lint/suspicious/noArrayIndexKey: read-only roster deliberately has no staff identifiers
                    key={index}
                    divider={index < data.team.length - 1}
                    alignItems="center"
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 2.5,
                      gap: { xs: 1.5, sm: 2 },
                      minWidth: 0,
                    }}
                  >
                    <BadgePersonContent
                      name={person.name}
                      secondary={person.email}
                      role={<EventAccessStatus role={person.role} />}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
          <Button
            variant="contained"
            startIcon={<PrintOutlined />}
            href={`/print/events/${eventId}/badges/bulk?mode=TEAM`}
            target="_blank"
            rel="noopener noreferrer"
            disabled={data.cancelled || data.teamTooLarge || !data.team.length}
            sx={{ alignSelf: "flex-start" }}
          >
            Print event team
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
