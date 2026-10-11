"use client";

import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { useEditorDirty } from "@/components/ui/editor-navigation-guard";
import { AuthText } from "@/features/auth/components/auth-text";
import {
  type ProfileFormState,
  updateProfile,
} from "@/features/auth/update-profile";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("auth");
  const [value, setValue] = useState(name);
  const [savedName, setSavedName] = useState(name);
  const nameInput = useRef<HTMLInputElement>(null);
  const dirty = value !== savedName;
  const notifications = useNotifications();
  const feedback = useFormFeedback<keyof Messages["auth"]>({}, t);
  const [, action, pending] = useActionState(
    async (previous: ProfileFormState, formData: FormData) => {
      notifications.close("profile-update");
      let next: ProfileFormState;

      try {
        next = await updateProfile(previous, formData);
      } catch (error) {
        unstable_rethrow(error);
        next = {
          message: "saveUnconfirmed",
        };
      }

      if (next.success && next.name !== undefined) {
        setValue(next.name);
        setSavedName(next.name);
        notifications.show(<AuthText id="profileUpdated" />, {
          severity: "success",
          key: "profile-update",
        });
      }

      feedback.setErrors(next.error ? { name: next.error } : {});
      feedback.setMessage(next.message);

      if (next.error) {
        requestAnimationFrame(() => nameInput.current?.focus());
      }

      return next;
    },
    {},
  );

  useEditorDirty("profile", dirty || pending);

  return (
    <Stack
      component="form"
      noValidate
      onSubmit={(event) => {
        if (pending || !dirty) {
          event.preventDefault();

          return;
        }

        feedback.reset();

        if (!value.trim() || value.trim().length > 200) {
          event.preventDefault();
          feedback.setErrors({ name: "nameLength" });
          nameInput.current?.focus();
        }
      }}
      action={action}
      spacing={3}
      aria-busy={pending}
      sx={{ maxWidth: 480 }}
    >
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t("profile")}
        </Typography>
        <Typography color="text.secondary">
          {t("profileDescription")}
        </Typography>
      </Stack>
      <TextField
        inputRef={nameInput}
        label={t("name")}
        name="name"
        autoComplete="name"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          feedback.clear("name");
        }}
        {...feedback.field("name")}
        slotProps={{ htmlInput: { maxLength: 200 } }}
        disabled={pending}
        required
        fullWidth
      />
      <TextField
        label={t("email")}
        value={email}
        disabled
        helperText={t("emailReadOnly")}
        fullWidth
      />
      {feedback.message && <Alert severity="error">{feedback.message}</Alert>}
      <Button
        type="submit"
        variant="contained"
        disabled={pending || !dirty || !value.trim()}
        sx={{ alignSelf: "flex-start" }}
      >
        {pending ? t("saving") : t("saveChanges")}
      </Button>
    </Stack>
  );
}
