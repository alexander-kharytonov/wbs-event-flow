"use client";

import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useActionState, useState } from "react";
import type { ApplicationFormState } from "@/features/events/application-input";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import { submitApplication } from "@/features/events/submit-application-action";
import { useNotifications } from "@/hooks/use-notifications";

export function RegistrationApplicationForm({
  publicId,
  eventRevisionId,
  fields,
}: {
  publicId: string;
  eventRevisionId: string;
  fields: EventSnapshot["registrationForm"]["fields"];
}) {
  const notifications = useNotifications();
  const [state, action, pending] = useActionState(
    async (previous: ApplicationFormState, formData: FormData) => {
      notifications.close("registration-submission");
      const next = await submitApplication(
        publicId,
        eventRevisionId,
        previous,
        formData,
      );

      if (next.message && !next.errors) {
        notifications.show(next.message, {
          severity: "error",
          key: "registration-submission",
        });
      }

      return next;
    },
    {},
  );
  // Keep entered values on validation errors, including unchecked/empty answers.
  const [values, setValues] = useState<Record<string, string[]>>({});
  const update = (name: string, value: string[]) =>
    setValues((previous) => ({ ...previous, [name]: value }));

  return (
    <Stack
      component="form"
      action={action}
      onReset={(event) => event.preventDefault()}
      spacing={3}
    >
      <Typography variant="h6" component="h2">
        Apply to attend
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Submit your details for organizer review. Required questions are marked
        with *.
      </Typography>
      {state.message && state.errors && (
        <Alert severity="error" role="alert">
          {state.message}
        </Alert>
      )}
      <TextField
        name="fullName"
        label="Full name"
        autoComplete="name"
        required
        fullWidth
        value={values.fullName?.[0] ?? ""}
        onChange={(event) => update("fullName", [event.target.value])}
        error={!!state.errors?.fullName}
        helperText={state.errors?.fullName}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        fullWidth
        value={values.email?.[0] ?? ""}
        onChange={(event) => update("email", [event.target.value])}
        error={!!state.errors?.email}
        helperText={state.errors?.email}
      />
      {fields.map((field) => {
        const name = `answer:${field.id}`;
        const selected = values[name] ?? [];
        const error = state.errors?.[name];

        if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
          return (
            <TextField
              key={field.id}
              name={name}
              label={field.label}
              required={field.required}
              multiline={field.type === "LONG_TEXT"}
              minRows={field.type === "LONG_TEXT" ? 3 : undefined}
              value={selected[0] ?? ""}
              onChange={(event) => update(name, [event.target.value])}
              error={!!error}
              helperText={error ?? field.description}
              fullWidth
              slotProps={{
                htmlInput: {
                  maxLength: field.type === "SHORT_TEXT" ? 500 : 5000,
                },
              }}
            />
          );
        }

        if (field.type === "SINGLE_CHOICE") {
          return (
            <TextField
              key={field.id}
              name={name}
              label={field.label}
              select
              required={field.required}
              value={selected[0] ?? ""}
              onChange={(event) =>
                update(name, event.target.value ? [event.target.value] : [])
              }
              error={!!error}
              helperText={error ?? field.description}
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
          );
        }

        return (
          <FormControl
            key={field.id}
            component={field.type === "CHECKBOX" ? "div" : "fieldset"}
            required={field.required}
            error={!!error}
          >
            {field.type !== "CHECKBOX" && (
              <FormLabel component="legend">{field.label}</FormLabel>
            )}
            <FormGroup aria-describedby={`${field.id}-help`}>
              {field.type === "CHECKBOX" ? (
                <FormControlLabel
                  label={field.label}
                  control={
                    <Checkbox
                      name={name}
                      value="true"
                      required={field.required}
                      checked={selected.includes("true")}
                      onChange={(event) =>
                        update(name, event.target.checked ? ["true"] : [])
                      }
                    />
                  }
                />
              ) : (
                field.options.map((option) => (
                  <FormControlLabel
                    key={option.id}
                    label={option.label}
                    control={
                      <Checkbox
                        name={name}
                        value={option.id}
                        checked={selected.includes(option.id)}
                        onChange={(event) =>
                          update(
                            name,
                            event.target.checked
                              ? [...selected, option.id]
                              : selected.filter((id) => id !== option.id),
                          )
                        }
                      />
                    }
                  />
                ))
              )}
            </FormGroup>
            <FormHelperText id={`${field.id}-help`}>
              {error ??
                field.description ??
                (field.required ? "Required" : "Optional")}
            </FormHelperText>
          </FormControl>
        );
      })}
      <Button
        type="submit"
        variant="contained"
        loading={pending}
        sx={{ alignSelf: "flex-start" }}
      >
        Submit application
      </Button>
    </Stack>
  );
}
