"use client";
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useTranslations } from "next-intl";
import type { ApplicationIssue } from "@/features/events/application-input";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function ApplicationQuestions({
  fields,
  values,
  errors,
  update,
  pending,
  preview = false,
  prefix = "answer:",
  formNames = true,
  selectPlaceholders,
}: {
  fields: EventSnapshot["registrationForm"]["fields"];
  values: Record<string, string[]>;
  errors: Record<string, ApplicationIssue>;
  update: (name: string, value: string[]) => void;
  pending: boolean;
  preview?: boolean;
  prefix?: string;
  formNames?: boolean;
  selectPlaceholders: { chooseOption: string; noSelection: string };
}) {
  const t = useTranslations("events");

  return (
    <>
      {fields.map((field) => {
        const name = `${prefix}${field.id}`;
        const selected = values[name] ?? [];
        const issue = errors[name];
        const error = issue ? t(issue.code, issue.values) : undefined;

        if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
          return (
            <Stack key={field.id} spacing={1}>
              <FormLabel
                id={`question-${name}-label`}
                htmlFor={`question-${name}`}
                required={field.required}
                error={!!error}
                sx={{
                  color: "text.primary",
                  typography: "subtitle1",
                  overflowWrap: "anywhere",
                }}
              >
                {field.label}
              </FormLabel>
              <TextField
                disabled={pending}
                id={`question-${name}`}
                name={formNames ? name : undefined}
                required={field.required}
                multiline={field.type === "LONG_TEXT"}
                minRows={field.type === "LONG_TEXT" ? 3 : undefined}
                value={selected[0] ?? ""}
                onChange={(event) => update(name, [event.target.value])}
                error={!!error}
                helperText={error ?? field.description}
                fullWidth
                slotProps={{
                  input: { readOnly: preview },
                  htmlInput: {
                    maxLength: field.type === "SHORT_TEXT" ? 500 : 5000,
                  },
                }}
              />
            </Stack>
          );
        }

        if (field.type === "SINGLE_CHOICE") {
          return (
            <Stack key={field.id} spacing={1}>
              <FormLabel
                id={`question-${name}-label`}
                htmlFor={`question-${name}`}
                required={field.required}
                error={!!error}
                sx={{
                  color: "text.primary",
                  typography: "subtitle1",
                  overflowWrap: "anywhere",
                }}
              >
                {field.label}
              </FormLabel>
              <TextField
                disabled={pending}
                id={`question-${name}`}
                name={formNames ? name : undefined}
                select
                slotProps={{
                  input: { readOnly: preview },
                  select: {
                    labelId: `question-${name}-label`,
                    displayEmpty: true,
                  },
                }}
                required={field.required}
                value={selected[0] ?? ""}
                onChange={(event) =>
                  update(name, event.target.value ? [event.target.value] : [])
                }
                error={!!error}
                helperText={error ?? field.description}
                fullWidth
              >
                <MenuItem value="">
                  {field.required
                    ? selectPlaceholders.chooseOption
                    : selectPlaceholders.noSelection}
                </MenuItem>
                {field.options.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
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
            error={!!error}
          >
            {field.type !== "CHECKBOX" && (
              <FormLabel
                component="legend"
                sx={{
                  color: "text.primary",
                  typography: "subtitle1",
                  overflowWrap: "anywhere",
                }}
              >
                {field.label}
              </FormLabel>
            )}
            <FormGroup aria-describedby={`${name}-help`}>
              {field.type === "CHECKBOX" ? (
                <FormControlLabel
                  label={field.label}
                  control={
                    <Checkbox
                      disabled={pending || preview}
                      name={formNames ? name : undefined}
                      slotProps={{
                        input: {
                          "aria-invalid": !!error,
                          "aria-describedby": `${name}-help`,
                        },
                      }}
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
                        disabled={pending || preview}
                        name={formNames ? name : undefined}
                        slotProps={{
                          input: {
                            "aria-invalid": !!error,
                            "aria-describedby": `${name}-help`,
                          },
                        }}
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
            <FormHelperText id={`${name}-help`}>
              {error ??
                field.description ??
                (field.required ? t("questionRequiredLabel") : t("optional"))}
            </FormHelperText>
          </FormControl>
        );
      })}
    </>
  );
}
