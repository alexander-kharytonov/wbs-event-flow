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
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { AuthText } from "@/features/auth/components/auth-text";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";
import type { Messages } from "@/lib/i18n/messages";

const cooldownKey = "event-flow:password-recovery-cooldown";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const feedback = useFormFeedback<keyof Messages["auth"]>({}, t);
  const notifications = useNotifications();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [cooldownLoaded, setCooldownLoaded] = useState(false);
  const inFlight = useRef(false);
  const retryAt = useRef(0);

  useEffect(() => {
    try {
      const saved = Number(sessionStorage.getItem(cooldownKey));
      retryAt.current = Number.isFinite(saved) ? saved : 0;
    } catch {
      // Server-side limits still apply when browser storage is unavailable.
    }

    const tick = () =>
      setRemaining(
        Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000)),
      );
    tick();
    setCooldownLoaded(true);
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function startCooldown() {
    retryAt.current = Date.now() + 60_000;
    setRemaining(60);

    try {
      sessionStorage.setItem(cooldownKey, String(retryAt.current));
    } catch {
      // Server-side limits still apply when browser storage is unavailable.
    }
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cooldownLoaded || inFlight.current || Date.now() < retryAt.current) {
      return;
    }

    feedback.reset();

    if (!z.email().safeParse(email.trim()).success) {
      feedback.setErrors({ email: "invalidEmail" });

      return;
    }

    inFlight.current = true;
    setPending(true);
    setSent(false);
    notifications.close("password-recovery");

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });

      if (result.error) {
        if (result.error.status === 429) {
          startCooldown();
        }

        feedback.setMessage(
          result.error.status === 429 ? "waitBeforeResend" : "requestFailed",
        );

        return;
      }

      startCooldown();
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
          {sent && (
            <Alert severity="info" role="status">
              {t("resetRequested")}
            </Alert>
          )}
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
                setSent(false);
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
              disabled={
                !cooldownLoaded || pending || remaining > 0 || !email.trim()
              }
            >
              {pending
                ? t("sending")
                : remaining > 0
                  ? t("resendIn", { count: remaining })
                  : t("sendResetLink")}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t("resetGoogleHint")}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
