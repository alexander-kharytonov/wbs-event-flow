"use client";

import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { AuthText } from "@/features/auth/components/auth-text";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";
import type { Messages } from "@/lib/i18n/messages";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const feedback = useFormFeedback<keyof Messages["auth"]>({}, t);
  const notifications = useNotifications();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    feedback.reset();

    if (!z.email().safeParse(email.trim()).success) {
      feedback.setErrors({ email: "invalidEmail" });

      return;
    }

    inFlight.current = true;
    setPending(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });

      if (result.error) {
        feedback.setMessage(
          result.error.status === 429 ? "waitBeforeResend" : "requestFailed",
        );

        return;
      }

      setSent(true);
      notifications.show(<AuthText id="resetRequested" />, {
        severity: "info",
        key: "password-recovery",
      });
    } catch {
      feedback.setMessage("connectionFailed");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Stack
      spacing={3}
      sx={{ width: "100%", maxWidth: 480, mx: "auto", my: "auto" }}
    >
      <BackLink href="/sign-in">{t("backSignIn")}</BackLink>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              {t("forgotPasswordTitle")}
            </Typography>
            <Typography color="text.secondary">
              {t("forgotPasswordDescription")}
            </Typography>
          </Stack>
          {sent ? (
            <Alert severity="info" role="status">
              {t("resetRequested")}
            </Alert>
          ) : (
            <Stack
              component="form"
              noValidate
              spacing={2.5}
              onSubmit={submit}
              aria-busy={pending}
            >
              <TextField
                label={t("email")}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  feedback.clear("email");
                }}
                {...feedback.field("email")}
                disabled={pending}
                required
                fullWidth
              />
              {feedback.message && (
                <Alert severity="error">{feedback.message}</Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                loading={pending}
                disabled={pending || !email.trim()}
              >
                {t(pending ? "sending" : "sendResetLink")}
              </Button>
            </Stack>
          )}
          <Typography variant="body2" color="text.secondary">
            {t("resetGoogleHint")}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
