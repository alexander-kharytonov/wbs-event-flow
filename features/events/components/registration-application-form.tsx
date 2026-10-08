"use client";

import {
  Alert,
  AlertTitle,
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
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  type ApplicationFormState,
  applicationAnswersSchema,
  applicationInputSchema,
} from "@/features/events/application-input";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import { submitApplication } from "@/features/events/submit-application-action";
import { useFormFeedback } from "@/hooks/use-form-feedback";

export function RegistrationApplicationForm({
  publicId,
  eventRevisionId,
  fields,
  applicant,
  initialValues = {},
}: {
  applicant?: { name: string; email: string };
  initialValues?: Record<string, string[]>;
  publicId: string;
  eventRevisionId: string;
  fields: EventSnapshot["registrationForm"]["fields"];
}) {
  const feedback = useFormFeedback();
  const router = useRouter();
  // Keep entered values on errors; discard them only after server success.
  const [values, setValues] = useState<Record<string, string[]>>(initialValues);
  const [state, action, pending] = useActionState(
    async (previous: ApplicationFormState, formData: FormData) => {
      const next = await submitApplication(
        publicId,
        eventRevisionId,
        previous,
        formData,
      );

      if (next.success) {
        setValues({});

        if (applicant) {
          router.refresh();
        }
      }
      feedback.setErrors(next.errors ?? {});
      feedback.setMessage(
        next.errors && Object.keys(next.errors).length
          ? undefined
          : next.message,
      );

      return next;
    },
    {},
  );
  const update = (name: string, value: string[]) => {
    feedback.clear(name);
    setValues((previous) => ({ ...previous, [name]: value }));
  };
  const complete =
    Boolean((values.fullName?.[0] ?? applicant?.name ?? "").trim()) &&
    Boolean((applicant?.email ?? values.email?.[0] ?? "").trim()) &&
    fields.every(
      (field) =>
        !field.required ||
        (values[`answer:${field.id}`] ?? []).some((value) => value.trim()),
    );

  if (state.success) {
    return (
      <Alert severity="success" role="status">
        <AlertTitle>Registration received</AlertTitle>
        Thank you! Your application has been submitted for organizer review.
      </Alert>
    );
  }

  return (
    <Stack
      component="form"
      action={action}
      noValidate
      onSubmit={(event) => {
        feedback.reset();
        const errors: Record<string, string> = {};
        const input = applicationInputSchema.safeParse({
          publicId,
          eventRevisionId,
          fullName: values.fullName?.[0] ?? applicant?.name ?? "",
          email: applicant?.email ?? values.email?.[0] ?? "",
          answers: Object.fromEntries(
            fields.map((field) => [
              field.id,
              values[`answer:${field.id}`] ?? [],
            ]),
          ),
        });

        if (!input.success) {
          for (const issue of input.error.issues) {
            errors[String(issue.path[0])] ??= issue.message;
          }
        }
        const answers = applicationAnswersSchema({
          registrationForm: { fields },
        }).safeParse(
          Object.fromEntries(
            fields.map((field) => [
              field.id,
              values[`answer:${field.id}`] ?? [],
            ]),
          ),
        );

        if (!answers.success) {
          for (const issue of answers.error.issues) {
            errors[`answer:${String(issue.path[0])}`] ??= issue.message;
          }
        }

        if (pending || Object.keys(errors).length) {
          event.preventDefault();
          feedback.setErrors(errors);
        }
      }}
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
      <TextField
        disabled={pending}
        name="fullName"
        label="Full name"
        autoComplete="name"
        required
        fullWidth
        value={values.fullName?.[0] ?? applicant?.name ?? ""}
        onChange={(event) => update("fullName", [event.target.value])}
        error={!!feedback.errors.fullName}
        helperText={feedback.errors.fullName}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <TextField
        disabled={pending}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        fullWidth
        value={applicant?.email ?? values.email?.[0] ?? ""}
        onChange={(event) => update("email", [event.target.value])}
        error={!!feedback.errors.email}
        helperText={
          feedback.errors.email ??
          (applicant ? "Using your verified account email." : undefined)
        }
        slotProps={{ input: { readOnly: !!applicant } }}
      />
      {fields.map((field) => {
        const name = `answer:${field.id}`;
        const selected = values[name] ?? [];
        const error = feedback.errors[name];

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
                disabled={pending}
                id={`question-${field.id}`}
                name={name}
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
                disabled={pending}
                id={`question-${field.id}`}
                name={name}
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
              <FormLabel component="legend">{field.label}</FormLabel>
            )}
            <FormGroup aria-describedby={`${field.id}-help`}>
              {field.type === "CHECKBOX" ? (
                <FormControlLabel
                  label={field.label}
                  control={
                    <Checkbox
                      disabled={pending}
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
                        disabled={pending}
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
      {feedback.message && <Alert severity="error">{feedback.message}</Alert>}
      <Button
        type="submit"
        disabled={!complete || pending}
        variant="contained"
        loading={pending}
        sx={{ alignSelf: "flex-start" }}
      >
        Submit application
      </Button>
    </Stack>
  );
}
