"use client";

import Add from "@mui/icons-material/Add";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
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
import { RegistrationFieldForm } from "@/features/events/components/registration-field-form";
import { changeRegistrationForm } from "@/features/events/registration-form-actions";
import {
  type BuilderField,
  type BuilderForm,
  fieldTypeLabels,
  type RegistrationFieldInput,
} from "@/features/events/schemas/registration-form";

type Command =
  | { kind: "add"; field: RegistrationFieldInput }
  | { kind: "edit"; fieldId: string; field: RegistrationFieldInput }
  | { kind: "delete"; fieldId: string }
  | { kind: "reorder"; fieldIds: string[] };

export function RegistrationFormBuilder({
  eventId,
  initialForm,
  published,
}: {
  eventId: string;
  initialForm: BuilderForm;
  published: boolean;
}) {
  // Keep the displayed snapshot and token together, including while a dialog is open.
  const [form, setForm] = useState(initialForm);
  const [editor, setEditor] = useState<{ field?: BuilderField } | null>(null);
  const [deleting, setDeleting] = useState<BuilderField | null>(null);
  const [error, setError] = useState<{
    message: string;
    conflict?: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const reloadHref = `/dashboard/events/${eventId}/registration-form`;
  const disabled = pending || published || Boolean(error?.conflict);

  function mutate(command: Command) {
    setNotice("");
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

          return;
        }

        setForm(result.form);
        setEditor(null);
        setDeleting(null);
        setNotice(
          command.kind === "delete"
            ? "Question deleted."
            : command.kind === "reorder"
              ? "Question order saved."
              : "Question saved.",
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
      {published && (
        <Alert severity="info">
          This event is published. Its registration form is read-only.
        </Alert>
      )}
      {error && !editor && (
        <Alert severity="error">
          {error.message}
          {error.conflict && (
            <Button color="inherit" href={reloadHref}>
              Reload latest version
            </Button>
          )}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" role="status">
          {notice}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" component="h2">
              Guest details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              These details are always required and cannot be changed.
            </Typography>
          </Box>
          {["Full name", "Email"].map((label) => (
            <Stack
              key={label}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center" }}
            >
              <LockOutlined fontSize="small" color="disabled" />
              <Typography sx={{ flex: 1 }}>{label}</Typography>
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
          <Typography variant="h6" component="h2">
            Questions
          </Typography>
          {!published && (
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
          )}
        </Stack>
        {form.fields.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1">No custom questions yet</Typography>
            <Typography color="text.secondary" variant="body2">
              {published
                ? "This form only contains the required guest details."
                : "Add questions to collect the information you need from your guests."}
            </Typography>
          </Paper>
        )}
        {form.fields.map((field, index) => (
          <Paper
            key={field.id}
            variant="outlined"
            sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}
          >
            <Stack spacing={1.5}>
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
              {!published && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
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
              )}
            </Stack>
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
            “{deleting?.label}” and its options will be permanently removed.
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error.message}
              {error.conflict && (
                <Button color="inherit" href={reloadHref}>
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
