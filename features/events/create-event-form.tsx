"use client";

import {
  Alert,
  Autocomplete,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useActionState, useEffect, useState } from "react";
import { createEvent } from "@/features/events/create-event";

const initialValues = {
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

export function CreateEventForm() {
  const [state, action, pending] = useActionState(createEvent, {});
  const [values, setValues] = useState(initialValues);
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezones(
      [
        ...new Set(["UTC", timezone, ...Intl.supportedValuesOf("timeZone")]),
      ].sort(),
    );
    setValues((current) => ({ ...current, timezone }));
  }, []);

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
      {state.message && (
        <Alert severity="error" role="alert">
          {state.message}
        </Alert>
      )}
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
      <Autocomplete
        freeSolo
        options={timezones}
        inputValue={values.timezone}
        onInputChange={(_, timezone) =>
          setValues((current) => ({ ...current, timezone }))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            name="timezone"
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
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? "Creating…" : "Create event"}
      </Button>
    </Stack>
  );
}
