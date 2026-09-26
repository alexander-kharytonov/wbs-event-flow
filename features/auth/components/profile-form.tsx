"use client";

import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { useActionState, useState } from "react";
import {
  type ProfileFormState,
  updateProfile,
} from "@/features/auth/update-profile";
import { useNotifications } from "@/hooks/use-notifications";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const notifications = useNotifications();
  const [state, action, pending] = useActionState(
    async (previous: ProfileFormState, formData: FormData) => {
      notifications.close("profile-update");
      const next = await updateProfile(previous, formData);

      if (next.success && next.name !== undefined) {
        setValue(next.name);
        notifications.show("Profile updated.", {
          severity: "success",
          key: "profile-update",
        });
      }

      return next;
    },
    {},
  );

  return (
    <Stack
      component="form"
      action={action}
      spacing={3}
      aria-busy={pending}
      sx={{ maxWidth: 480 }}
    >
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          Profile
        </Typography>
        <Typography color="text.secondary">
          Manage your Event Flow account details.
        </Typography>
      </Stack>
      {state.message && <Alert severity="error">{state.message}</Alert>}
      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={Boolean(state.error)}
        helperText={state.error}
        slotProps={{ htmlInput: { maxLength: 200 } }}
        disabled={pending}
        required
        fullWidth
      />
      <TextField
        label="Email"
        value={email}
        slotProps={{ input: { readOnly: true } }}
        helperText="Email changes are not available yet."
        fullWidth
      />
      <Button
        type="submit"
        variant="contained"
        disabled={pending}
        sx={{ alignSelf: "flex-start" }}
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </Stack>
  );
}
