"use client";

import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  Stack,
  TextField,
  Typography,
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
            <TextField
              key={field.id}
              label={field.label}
              required={field.required}
              helperText={field.description}
              multiline={field.type === "LONG_TEXT"}
              minRows={field.type === "LONG_TEXT" ? 3 : undefined}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
          );
        }

        return (
          <FormControl
            key={field.id}
            required={field.required}
            component={field.type === "CHECKBOX" ? "div" : "fieldset"}
          >
            {field.type !== "CHECKBOX" && (
              <FormLabel component="legend">{field.label}</FormLabel>
            )}
            {field.description && (
              <Typography variant="body2" color="text.secondary">
                {field.description}
              </Typography>
            )}
            {field.type === "CHECKBOX" ? (
              <FormControlLabel
                control={<Checkbox disabled />}
                label={field.label}
              />
            ) : (
              field.options.map((option) => (
                <FormControlLabel
                  key={option.id}
                  control={
                    field.type === "SINGLE_CHOICE" ? (
                      <Radio disabled />
                    ) : (
                      <Checkbox disabled />
                    )
                  }
                  label={option.label}
                />
              ))
            )}
          </FormControl>
        );
      })}
    </Stack>
  );
}
