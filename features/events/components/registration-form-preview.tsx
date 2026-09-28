"use client";

import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Stack,
  TextField,
} from "@mui/material";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

// MUI inspects and clones control.props; create controls within the client
// boundary instead of passing server-rendered elements into that prop.
export function RegistrationFormPreview({
  fields,
}: EventSnapshot["registrationForm"]) {
  return (
    <Stack spacing={3}>
      <TextField
        label="Full name"
        required
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <TextField
        label="Email"
        type="email"
        required
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      {fields.map((field) => {
        if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
          return (
            <Stack key={field.id} spacing={1}>
              <FormLabel
                htmlFor={`question-${field.id}`}
                required={field.required}
                sx={{ color: "text.primary", overflowWrap: "anywhere" }}
              >
                {field.label}
              </FormLabel>
              <TextField
                id={`question-${field.id}`}
                required={field.required}
                helperText={field.description}
                multiline={field.type === "LONG_TEXT"}
                minRows={field.type === "LONG_TEXT" ? 3 : undefined}
                fullWidth
                slotProps={{ input: { readOnly: true } }}
              />
            </Stack>
          );
        }

        if (field.type === "SINGLE_CHOICE") {
          return (
            <Stack key={field.id} spacing={1}>
              <FormLabel
                htmlFor={`question-${field.id}`}
                required={field.required}
                sx={{ color: "text.primary", overflowWrap: "anywhere" }}
              >
                {field.label}
              </FormLabel>
              <TextField
                id={`question-${field.id}`}
                select
                required={field.required}
                value=""
                disabled
                helperText={field.description}
                fullWidth
                slotProps={{
                  select: { native: true },
                  inputLabel: { shrink: true },
                }}
              >
                <option value="">
                  {field.required ? "Choose an option" : "No selection"}
                </option>
                {field.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </TextField>
            </Stack>
          );
        }

        return (
          <FormControl
            key={field.id}
            component={field.type === "CHECKBOX" ? "div" : "fieldset"}
            required={field.required}
          >
            {field.type !== "CHECKBOX" && (
              <FormLabel component="legend">{field.label}</FormLabel>
            )}
            <FormGroup aria-describedby={`${field.id}-help`}>
              {field.type === "CHECKBOX" ? (
                <FormControlLabel
                  label={field.label}
                  control={<Checkbox disabled required={field.required} />}
                />
              ) : (
                field.options.map((option) => (
                  <FormControlLabel
                    key={option.id}
                    label={option.label}
                    control={<Checkbox disabled />}
                  />
                ))
              )}
            </FormGroup>
            <FormHelperText id={`${field.id}-help`}>
              {field.description ?? (field.required ? "Required" : "Optional")}
            </FormHelperText>
          </FormControl>
        );
      })}
    </Stack>
  );
}
