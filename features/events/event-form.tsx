"use client";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useActionState, useEffect, useState } from "react";
import type {
  EventFormState,
  EventFormValues,
} from "@/features/events/event-input-schema";
import { formatTimezone } from "@/features/events/format-timezone";
import { useNotifications } from "@/hooks/use-notifications";

const emptyValues: EventFormValues = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  timezone: "",
  visibility: "PRIVATE",
  accountRequirement: "OPTIONAL",
  capacity: "",
  registrationOpensAt: "",
  registrationClosesAt: "",
};

export function EventForm({
  initialValues = emptyValues,
  serverAction,
  edit,
}: {
  initialValues?: EventFormValues;
  serverAction: (
    previous: EventFormState,
    formData: FormData,
  ) => Promise<EventFormState>;
  edit?: { id: string; version: string };
}) {
  const notifications = useNotifications();
  const [state, action, pending] = useActionState(
    async (previous: EventFormState, formData: FormData) => {
      notifications.close("event-form");
      const next = await serverAction(previous, formData);

      if (next.message && !next.errors && !next.conflict) {
        notifications.show(next.message, {
          severity: "error",
          key: "event-form",
        });
      }

      return next;
    },
    {},
  );
  const [values, setValues] = useState(initialValues);
  const [openedVersion] = useState(edit?.version);
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezones(
      [
        ...new Set(["UTC", timezone, ...Intl.supportedValuesOf("timeZone")]),
      ].sort(),
    );

    if (!edit) {
      setValues((current) => ({ ...current, timezone }));
    }
  }, [edit]);

  function field(name: keyof typeof values) {
    return {
      name,
      value: values[name],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setValues((current) => ({ ...current, [name]: event.target.value })),
      error: Boolean(state.errors?.[name]),
      helperText: state.errors?.[name]?.[0],
      fullWidth: true,
    };
  }

  return (
    <Stack component="form" action={action} spacing={3}>
      {edit && (
        <>
          <input type="hidden" name="eventId" value={edit.id} />
          <input type="hidden" name="version" value={openedVersion} />
        </>
      )}
      {state.message && (state.errors || state.conflict) && (
        <Alert severity="error" role="alert">
          {state.message}
          {state.conflict && edit && (
            <Box sx={{ mt: 1 }}>
              <Button
                color="inherit"
                size="small"
                href={`/dashboard/events/${edit.id}/edit`}
              >
                Reload latest version
              </Button>
            </Box>
          )}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Typography variant="h6" component="h2">
            Basic information
          </Typography>
          <TextField
            {...field("title")}
            label="Event name"
            required
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            {...field("description")}
            label="Description"
            multiline
            minRows={3}
            slotProps={{ htmlInput: { maxLength: 20000 } }}
          />
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Typography variant="h6" component="h2">
            Schedule
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 3,
            }}
          >
            <TextField
              {...field("startsAt")}
              label="Start"
              type="datetime-local"
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              {...field("endsAt")}
              label="End"
              type="datetime-local"
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
          <input type="hidden" name="timezone" value={values.timezone} />
          <Autocomplete
            freeSolo
            options={timezones}
            getOptionLabel={formatTimezone}
            filterOptions={(options, { inputValue }) => {
              const query = formatTimezone(inputValue).toLowerCase();

              return options.filter((timezone) =>
                formatTimezone(timezone).toLowerCase().includes(query),
              );
            }}
            inputValue={formatTimezone(values.timezone)}
            onInputChange={(_, timezone) =>
              setValues((current) => ({
                ...current,
                timezone: timezone.replaceAll(" ", "_"),
              }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Timezone"
                required
                error={Boolean(state.errors?.timezone)}
                helperText={
                  state.errors?.timezone?.[0] ??
                  "All dates and times use this IANA timezone."
                }
              />
            )}
          />
          <Typography variant="body2" color="text.secondary">
            Times skipped or repeated during daylight saving changes must be
            replaced with an unambiguous time.
          </Typography>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Typography variant="h6" component="h2">
            Registration
          </Typography>
          <TextField
            {...field("capacity")}
            label="Guest capacity"
            type="number"
            slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
            helperText={
              state.errors?.capacity?.[0] ??
              "Leave blank for no limit on approved guests."
            }
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 3,
            }}
          >
            <TextField
              {...field("registrationOpensAt")}
              label="Registration opens"
              type="datetime-local"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              {...field("registrationClosesAt")}
              label="Registration closes"
              type="datetime-local"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Typography variant="h6" component="h2">
            Access
          </Typography>
          <TextField {...field("visibility")} label="Visibility" select>
            <MenuItem value="PRIVATE">Private</MenuItem>
            <MenuItem value="PUBLIC">Public</MenuItem>
          </TextField>
          <TextField
            {...field("accountRequirement")}
            label="Account requirement"
            select
          >
            <MenuItem value="OPTIONAL">Optional</MenuItem>
            <MenuItem value="REQUIRED">Required</MenuItem>
          </TextField>
        </Stack>
      </Paper>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button type="submit" variant="contained" disabled={pending}>
          {pending
            ? edit
              ? "Saving…"
              : "Creating…"
            : edit
              ? "Save changes"
              : "Create event"}
        </Button>
        <Button
          href={edit ? `/dashboard/events/${edit.id}` : "/dashboard"}
          color="inherit"
        >
          {edit ? "Back to event" : "Back to my events"}
        </Button>
      </Stack>
    </Stack>
  );
}
