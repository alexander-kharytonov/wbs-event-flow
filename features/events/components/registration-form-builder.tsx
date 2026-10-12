"use client";

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
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { EventText } from "@/features/events/components/event-text";
import { RegistrationFieldForm } from "@/features/events/components/registration-field-form";
import { RegistrationQuestions } from "@/features/events/components/registration-questions";
import { changeRegistrationForm } from "@/features/events/registration-form-actions";
import type {
  BuilderField,
  BuilderForm,
  RegistrationFieldInput,
} from "@/features/events/schemas/registration-form";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

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
  const t = useTranslations("events");
  // Keep the displayed snapshot and token together, including while a dialog is open.
  const [form, setForm] = useState(initialForm);
  const [editor, setEditor] = useState<{ field?: BuilderField } | null>(null);
  const [deleting, setDeleting] = useState<BuilderField | null>(null);
  const [error, setError] = useState<{
    message: keyof Messages["events"];
    conflict?: boolean;
    fieldErrors?: Record<string, keyof Messages["events"]>;
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
            notifications.show(<EventText id={result.message} />, {
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
          <EventText
            id={
              command.kind === "delete"
                ? "questionDeleted"
                : command.kind === "reorder"
                  ? "questionOrderSaved"
                  : "questionSaved"
            }
          />,
          {
            severity: "success",
            autoHideDuration: 4000,
            key: `registration-form:${eventId}`,
          },
        );
      } catch {
        setError({
          message: "questionConfirmFailed",
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
          {t(error.message)}
          {error.conflict && (
            <Button component="a" color="inherit" href={reloadHref}>
              {t("reloadLatest")}
            </Button>
          )}
        </Alert>
      )}
      <SectionHeader
        title={t("registrationForm")}
        description={t("questionWorkspaceHint")}
      />
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
              {t("questionGuestDetails")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("questionAlwaysCollected")}
            </Typography>
          </Box>
          {[t("fullName"), t("email")].map((label) => (
            <Stack
              key={label}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", gap: 1 }}
            >
              <LockOutlined fontSize="small" color="disabled" />
              <Typography>{label}</Typography>
              <Chip
                label={t("questionRequiredLabel")}
                size="small"
                variant="outlined"
              />
            </Stack>
          ))}
        </Stack>
      </Paper>
      <RegistrationQuestions
        fields={form.fields}
        getKey={(field) => field.id}
        disabled={disabled}
        onAdd={() => {
          setError(null);
          setEditor({});
        }}
        onEdit={(field) => {
          setError(null);
          setEditor({ field });
        }}
        onDelete={(field) => {
          setError(null);
          setDeleting(field);
        }}
        onMove={move}
      />
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
          {editor?.field ? t("questionEdit") : t("questionAdd")}
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
        <DialogTitle id="delete-dialog-title">
          {t("questionDeleteTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ overflowWrap: "anywhere" }}>
            {t("questionDeleteHint", { label: deleting?.label ?? "" })}
          </DialogContentText>
          {error?.conflict && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t(error.message)}
              {error.conflict && (
                <Button component="a" color="inherit" href={reloadHref}>
                  {t("reloadLatest")}
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
            {t("cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={disabled}
            onClick={() => {
              if (deleting) mutate({ kind: "delete", fieldId: deleting.id });
            }}
          >
            {pending ? t("questionDeleting") : t("questionDelete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
