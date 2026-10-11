"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  type SyntheticEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { BackLink } from "@/components/ui/back-link";
import {
  type ApplicationFormState,
  applicationAnswersSchema,
  applicationInputSchema,
} from "@/features/events/application-input";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import { submitApplication } from "@/features/events/submit-application-action";
import { useFormFeedback } from "@/hooks/use-form-feedback";

export function RegistrationApplicationForm({
  publicId = "",
  eventRevisionId: currentRevisionId = "",
  preview = false,
  fields: currentFields,
  reapplication = false,
  applicant,
  eventContext,
  initialValues = {},
}: {
  applicant?: { name: string; email: string };
  reapplication?: boolean;
  eventContext: ReactNode;
  initialValues?: Record<string, string[]>;
  fields: EventSnapshot["registrationForm"]["fields"];
} & (
  | { preview: true; publicId?: never; eventRevisionId?: never }
  | { preview?: false; publicId: string; eventRevisionId: string }
)) {
  // Keep the opened question definitions and revision together across server refreshes.
  // The parent unmounts this component when current eligibility is lost.
  const [openedForm] = useState(() => ({
    eventRevisionId: currentRevisionId,
    fields: currentFields,
  }));
  const fields = preview ? currentFields : openedForm.fields;
  const eventRevisionId = preview
    ? currentRevisionId
    : openedForm.eventRevisionId;
  const formChanged = !preview && currentRevisionId !== eventRevisionId;
  const mustRestart = reapplication && formChanged;
  const feedback = useFormFeedback();
  const router = useRouter();
  const formRef = useRef<HTMLElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const focusFirstError = () => setFocusRequest((current) => current + 1);
  // Keep entered values on errors; discard them only after server success.
  const [values, setValues] = useState<Record<string, string[]>>(initialValues);
  const [state, action, pending] = useActionState(
    async (previous: ApplicationFormState, formData: FormData) => {
      if (preview || mustRestart || !publicId || !eventRevisionId) {
        return {};
      }

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
      feedback.setMessage(next.message);

      if (!next.success && next.errors) {
        focusFirstError();
      }

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

  const hasFieldErrors = Object.keys(feedback.errors).some(
    (name) =>
      name === "fullName" ||
      name === "email" ||
      fields.some((field) => name === `answer:${field.id}`),
  );

  useEffect(() => {
    if (!focusRequest || pending) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not([type="hidden"]):not([aria-hidden="true"])',
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      setFocusRequest(0);
    });

    return () => cancelAnimationFrame(frame);
  }, [focusRequest, pending]);

  function validateFields() {
    const errors: Record<string, string> = {};

    if (preview) {
      return errors;
    }
    const input = applicationInputSchema.safeParse({
      publicId,
      eventRevisionId,
      fullName: values.fullName?.[0] ?? applicant?.name ?? "",
      email: applicant?.email ?? values.email?.[0] ?? "",
      answers: Object.fromEntries(
        fields.map((field) => [field.id, values[`answer:${field.id}`] ?? []]),
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
        fields.map((field) => [field.id, values[`answer:${field.id}`] ?? []]),
      ),
    );

    if (!answers.success) {
      for (const issue of answers.error.issues) {
        errors[`answer:${String(issue.path[0])}`] ??= issue.message;
      }
    }

    return errors;
  }

  function checkRequiredFields() {
    const errors = validateFields();
    feedback.setErrors(errors);

    if (Object.keys(errors).length) {
      focusFirstError();
    }
  }

  if (state.success) {
    return (
      <Stack spacing={3}>
        {eventContext}
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={3}>
            <Alert severity="success" role="status">
              <AlertTitle>Registration received</AlertTitle>
              Thank you! Your application has been submitted.
            </Alert>
            <Alert severity="info">
              The organizer will review your application. A place is confirmed
              only after approval.
            </Alert>
            <BackLink href={`/e/${publicId}`}>Back to event</BackLink>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack
      component={preview ? "div" : "form"}
      ref={(element: HTMLElement | null) => {
        formRef.current = element;
      }}
      aria-busy={pending}
      action={preview ? undefined : action}
      noValidate
      onSubmit={(event: SyntheticEvent<HTMLElement>) => {
        if (preview) {
          event.preventDefault();

          return;
        }
        feedback.reset();
        const errors = validateFields();

        if (pending || mustRestart || Object.keys(errors).length) {
          event.preventDefault();
          feedback.setErrors(errors);

          if (Object.keys(errors).length) {
            feedback.setMessage(
              "Check the highlighted fields before submitting.",
            );
            focusFirstError();
          }
        }
      }}
      onReset={(event: SyntheticEvent<HTMLElement>) => event.preventDefault()}
      spacing={{ xs: 4, sm: 5 }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
          gap: 3,
          alignItems: "stretch",
        }}
      >
        {eventContext}
        <Paper
          variant="outlined"
          component="section"
          aria-labelledby="applicant-details-title"
          sx={{ p: { xs: 2.5, sm: 4 } }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography
                id="applicant-details-title"
                variant="h6"
                component="h2"
              >
                Your details
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                Fields marked * are required.
              </Typography>
            </Box>
            <Stack spacing={3}>
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
                slotProps={{
                  input: { readOnly: preview },
                  htmlInput: { maxLength: 200 },
                }}
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
                slotProps={{ input: { readOnly: preview || !!applicant } }}
              />
            </Stack>
          </Stack>
        </Paper>
      </Box>
      {formChanged && (
        <Alert
          severity="info"
          sx={{
            flexWrap: { xs: "wrap", sm: "nowrap" },
            "& .MuiAlert-action": {
              width: { xs: "100%", sm: "auto" },
              pl: { xs: 0, sm: 2 },
              pt: { xs: 1, sm: 0 },
            },
          }}
          action={
            <Button
              color="inherit"
              disabled={pending}
              onClick={() => window.location.reload()}
            >
              Start over with latest form
            </Button>
          }
        >
          {reapplication
            ? "The registration form has changed. Reapplying requires the latest form. Your current answers are kept until you start over."
            : "A newer registration form is available. You can submit this version or start over with the latest form."}{" "}
          Starting over clears your unsaved answers.
        </Alert>
      )}
      {fields.length > 0 && (
        <Box
          component="section"
          aria-labelledby="application-questions-title"
          sx={{ px: { xs: 0.5, sm: 4 } }}
        >
          <Stack spacing={3.5}>
            <Box>
              <Typography
                id="application-questions-title"
                variant="h5"
                component="h2"
              >
                Registration questions
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                {fields.length} {fields.length === 1 ? "question" : "questions"}{" "}
                from the organizer
              </Typography>
            </Box>
            <Stack
              spacing={{ xs: 3, sm: 3.5 }}
              sx={{
                "& .MuiFormControl-root": { minWidth: 0 },
                "& .MuiFormControlLabel-label": {
                  overflowWrap: "anywhere",
                },
                "& .MuiFormHelperText-root": { overflowWrap: "anywhere" },
              }}
            >
              {fields.map((field) => {
                const name = `answer:${field.id}`;
                const selected = values[name] ?? [];
                const error = feedback.errors[name];

                if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
                  return (
                    <Stack key={field.id} spacing={1}>
                      <FormLabel
                        id={`question-${field.id}-label`}
                        htmlFor={`question-${field.id}`}
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
                        id={`question-${field.id}-label`}
                        htmlFor={`question-${field.id}`}
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
                        id={`question-${field.id}`}
                        name={name}
                        select
                        slotProps={{
                          input: { readOnly: preview },
                          select: {
                            labelId: `question-${field.id}-label`,
                            displayEmpty: true,
                          },
                        }}
                        required={field.required}
                        value={selected[0] ?? ""}
                        onChange={(event) =>
                          update(
                            name,
                            event.target.value ? [event.target.value] : [],
                          )
                        }
                        error={!!error}
                        helperText={error ?? field.description}
                        fullWidth
                      >
                        <MenuItem value="">
                          {field.required ? "Choose an option" : "No selection"}
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
                    <FormGroup aria-describedby={`${field.id}-help`}>
                      {field.type === "CHECKBOX" ? (
                        <FormControlLabel
                          label={field.label}
                          control={
                            <Checkbox
                              disabled={pending || preview}
                              name={name}
                              slotProps={{
                                input: {
                                  "aria-invalid": !!error,
                                  "aria-describedby": `${field.id}-help`,
                                },
                              }}
                              value="true"
                              required={field.required}
                              checked={selected.includes("true")}
                              onChange={(event) =>
                                update(
                                  name,
                                  event.target.checked ? ["true"] : [],
                                )
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
                                name={name}
                                slotProps={{
                                  input: {
                                    "aria-invalid": !!error,
                                    "aria-describedby": `${field.id}-help`,
                                  },
                                }}
                                value={option.id}
                                checked={selected.includes(option.id)}
                                onChange={(event) =>
                                  update(
                                    name,
                                    event.target.checked
                                      ? [...selected, option.id]
                                      : selected.filter(
                                          (id) => id !== option.id,
                                        ),
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
            </Stack>
          </Stack>
        </Box>
      )}
      {!preview && (
        <Paper
          variant="outlined"
          component="section"
          aria-label="Submit application"
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderTop: 3,
            borderTopColor: "primary.main",
            bgcolor: "action.hover",
          }}
        >
          <Stack spacing={3}>
            {feedback.message && (
              <Alert severity="error">{feedback.message}</Alert>
            )}
            {Object.entries(feedback.errors)
              .filter(
                ([name]) =>
                  name !== "fullName" &&
                  name !== "email" &&
                  !fields.some((field) => name === `answer:${field.id}`),
              )
              .map(([name, message]) => (
                <Alert severity="error" key={name}>
                  {message}
                </Alert>
              ))}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={3}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    color: "primary.main",
                    display: "flex",
                  }}
                >
                  <SendOutlined />
                </Box>
                <Typography variant="h5" component="h2">
                  Ready to join us?
                </Typography>
              </Stack>
              <Stack spacing={1} sx={{ flexShrink: 0 }}>
                {(!complete || hasFieldErrors) && (
                  <Button
                    type="button"
                    variant="outlined"
                    color={hasFieldErrors ? "error" : "primary"}
                    size="small"
                    disabled={pending}
                    onClick={
                      hasFieldErrors ? focusFirstError : checkRequiredFields
                    }
                  >
                    {hasFieldErrors
                      ? "Review errors"
                      : "Complete required fields"}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!complete || pending || mustRestart}
                  variant="contained"
                  loading={pending}
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{
                    flexShrink: 0,
                    minWidth: { sm: 220 },
                  }}
                >
                  Submit application
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
