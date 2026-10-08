"use client";

import Add from "@mui/icons-material/Add";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import QuizOutlined from "@mui/icons-material/QuizOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistrationFieldForm } from "@/features/events/components/registration-field-form";
import { changeRegistrationForm } from "@/features/events/registration-form-actions";
import {
  type BuilderField,
  type BuilderForm,
  fieldTypeLabels,
  type RegistrationFieldInput,
} from "@/features/events/schemas/registration-form";
import { useNotifications } from "@/hooks/use-notifications";

type Command =
  | { kind: "add"; field: RegistrationFieldInput }
  | { kind: "edit"; fieldId: string; field: RegistrationFieldInput }
  | { kind: "delete"; fieldId: string }
  | { kind: "reorder"; fieldIds: string[] };

export function RegistrationFormBuilder({
  eventId,
  initialForm,
}: {
  eventId: string;
  initialForm: BuilderForm;
}) {
  // Keep the displayed snapshot and token together, including while a dialog is open.
  const [form, setForm] = useState(initialForm);
  const [editor, setEditor] = useState<{ field?: BuilderField } | null>(null);
  const [deleting, setDeleting] = useState<BuilderField | null>(null);
  const [error, setError] = useState<{
    message: string;
    conflict?: boolean;
    fieldErrors?: Record<string, string>;
  } | null>(null);
  const notifications = useNotifications();
  const [pending, startTransition] = useTransition();
  const reloadHref = `/dashboard/events/${eventId}/registration-form`;
  const disabled = pending || Boolean(error?.conflict);

  function mutate(command: Command) {
    notifications.close(`registration-form:${eventId}`);
    setError(null);
    startTransition(async () => {
      try {
        const result = await changeRegistrationForm({
          ...command,
          eventId,
          version: form.version,
        });

        if (!result.form) {
          setError(result);

          if (!result.conflict && !editor) {
            notifications.show(result.message, {
              severity: "error",
              key: `registration-form:${eventId}`,
            });
          }

          return;
        }

        setForm(result.form);
        setEditor(null);
        setDeleting(null);
        notifications.show(
          command.kind === "delete"
            ? "Question deleted."
            : command.kind === "reorder"
              ? "Question order saved."
              : "Question saved.",
          {
            severity: "success",
            autoHideDuration: 4000,
            key: `registration-form:${eventId}`,
          },
        );
      } catch {
        setError({
          message:
            "We couldn’t confirm the save. Reload the latest version before trying again.",
          conflict: true,
        });
      }
    });
  }

  function move(index: number, offset: number) {
    const fieldIds = form.fields.map((field) => field.id);
    [fieldIds[index], fieldIds[index + offset]] = [
      fieldIds[index + offset],
      fieldIds[index],
    ];
    mutate({ kind: "reorder", fieldIds });
  }

  return (
    <Stack spacing={3} aria-busy={pending}>
      {error?.conflict && !editor && !deleting && (
        <Alert severity="error">
          {error.message}
          {error.conflict && (
            <Button component="a" color="inherit" href={reloadHref}>
              Reload latest version
            </Button>
          )}
        </Alert>
      )}
      <Alert severity="info">
        Questions save to your workspace. Publish changes when you’re ready.
      </Alert>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{ gap: 2, alignItems: { md: "center" } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
            >
              Guest details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Always collected with every application.
            </Typography>
          </Box>
          {["Full name", "Email"].map((label) => (
            <Stack
              key={label}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", gap: 1 }}
            >
              <LockOutlined fontSize="small" color="disabled" />
              <Typography>{label}</Typography>
              <Chip label="Required" size="small" variant="outlined" />
            </Stack>
          ))}
        </Stack>
      </Paper>
      <Stack component="section" spacing={2}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between" }}
          spacing={1}
        >
          <Typography
            variant="h6"
            component="h2"
            sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
          >
            Questions
          </Typography>
          {
            <Button
              startIcon={<Add />}
              variant="contained"
              disabled={disabled}
              onClick={() => {
                setError(null);
                setEditor({});
              }}
            >
              Add question
            </Button>
          }
        </Stack>
        {form.fields.length === 0 && (
          <EmptyState
            icon={<QuizOutlined />}
            title="No custom questions yet"
            description="Add questions to collect the information you need from your guests."
          />
        )}
        {form.fields.map((field, index) => (
          <Paper
            key={field.id}
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2.5 } }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  md: "minmax(0, 1fr) auto",
                },
                gap: 2,
              }}
            >
              <Stack spacing={1}>
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {index + 1}. {field.label}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={fieldTypeLabels[field.type]} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={field.required ? "Required" : "Optional"}
                  />
                </Stack>
                {field.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {field.description}
                  </Typography>
                )}
                {field.options.length > 0 && (
                  <Box
                    component="ol"
                    sx={{ m: 0, pl: 3, overflowWrap: "anywhere" }}
                  >
                    {field.options.map((option) => (
                      <Typography
                        component="li"
                        variant="body2"
                        key={option.label}
                      >
                        {option.label}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Stack>
              {
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "center",
                    alignSelf: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <IconButton
                    aria-label={`Move question ${index + 1} up`}
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpward fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={`Move question ${index + 1} down`}
                    disabled={disabled || index === form.fields.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownward fontSize="small" />
                  </IconButton>
                  <Button
                    startIcon={<EditOutlined />}
                    disabled={disabled}
                    onClick={() => {
                      setError(null);
                      setEditor({ field });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    startIcon={<DeleteOutlined />}
                    color="error"
                    disabled={disabled}
                    onClick={() => {
                      setError(null);
                      setDeleting(field);
                    }}
                  >
                    Delete
                  </Button>
                </Stack>
              }
            </Box>
          </Paper>
        ))}
      </Stack>
      <Dialog
        open={editor !== null}
        onClose={() => {
          if (!pending) setEditor(null);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="field-dialog-title"
      >
        <DialogTitle id="field-dialog-title">
          {editor?.field ? "Edit question" : "Add question"}
        </DialogTitle>
        {editor && (
          <RegistrationFieldForm
            initial={editor.field}
            pending={pending}
            message={error?.message}
            fieldErrors={error?.fieldErrors}
            conflict={error?.conflict}
            reloadHref={reloadHref}
            onCancel={() => setEditor(null)}
            onSave={(field) =>
              mutate(
                editor.field
                  ? { kind: "edit", fieldId: editor.field.id, field }
                  : { kind: "add", field },
              )
            }
          />
        )}
      </Dialog>
      <Dialog
        open={deleting !== null}
        onClose={() => {
          if (!pending) setDeleting(null);
        }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete question?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ overflowWrap: "anywhere" }}>
            “{deleting?.label}” will be removed from your workspace form.
            Previously submitted answers will be preserved.
          </DialogContentText>
          {error?.conflict && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error.message}
              {error.conflict && (
                <Button component="a" color="inherit" href={reloadHref}>
                  Reload latest version
                </Button>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={pending}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={disabled}
            onClick={() => {
              if (deleting) mutate({ kind: "delete", fieldId: deleting.id });
            }}
          >
            {pending ? "Deleting…" : "Delete question"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
