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
import {
  rememberVerificationEmail,
  startVerificationCooldown,
  verificationCallbackURL,
  verificationCooldownKey,
  verificationEmailKey,
} from "@/features/auth/verification-flow";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";
import type { Messages } from "@/lib/i18n/messages";
import { safeReturnPath } from "@/lib/safe-return-path";

export function VerificationForm({
  returnTo,
  invalidLink,
  deliveryFailed,
}: {
  returnTo?: string;
  invalidLink: boolean;
  deliveryFailed: boolean;
}) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [cooldownLoaded, setCooldownLoaded] = useState(false);
  const notifications = useNotifications();
  const feedback = useFormFeedback<keyof Messages["auth"]>({}, t);
  const [hasFeedback, setHasFeedback] = useState(false);
  const inFlight = useRef(false);
  const retryAt = useRef(0);
  const destination = safeReturnPath(returnTo);
  const signInHref = `/sign-in${destination ? `?${new URLSearchParams({ returnTo: destination })}` : ""}`;

  useEffect(() => {
    try {
      setEmail(sessionStorage.getItem(verificationEmailKey) ?? "");
      const saved = Number(sessionStorage.getItem(verificationCooldownKey));
      retryAt.current = Number.isFinite(saved) ? saved : 0;
    } catch {
      // Direct visits and browsers without storage can enter their email below.
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
    retryAt.current = startVerificationCooldown();
    setRemaining(60);
  }

  async function resend(event: React.SubmitEvent<HTMLFormElement>) {
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
    notifications.close("verification-resend");
    setHasFeedback(false);
    rememberVerificationEmail(email);

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: verificationCallbackURL(destination),
      });

      if (result.error) {
        if (result.error.status === 429) {
          startCooldown();
        }

        setHasFeedback(true);

        if (result.error.code === "INVALID_EMAIL") {
          feedback.setErrors({
            email: "invalidEmail",
          });
        } else {
          feedback.setMessage(
            result.error.status === 429
              ? "waitBeforeResend"
              : "sendVerificationFailed",
          );
        }

        return;
      }

      startCooldown();
      setHasFeedback(true);
      notifications.show(<AuthText id="verificationSent" />, {
        severity: "info",
        key: "verification-resend",
      });
    } catch {
      setHasFeedback(true);
      feedback.setMessage("deliveryUnconfirmed");
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
      <BackLink href="/">{t("backHome")}</BackLink>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              {t("verifyEmail")}
            </Typography>
            <Typography color="text.secondary">
              {t("verificationInstructions")}
            </Typography>
          </Stack>
          {invalidLink && !hasFeedback && (
            <Alert severity="warning">{t("invalidVerificationLink")}</Alert>
          )}
          {deliveryFailed && !hasFeedback && (
            <Alert severity="error">{t("verificationDeliveryFailed")}</Alert>
          )}
          <Stack
            component="form"
            noValidate
            onSubmit={resend}
            spacing={2}
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
              disabled={
                !cooldownLoaded || pending || remaining > 0 || !email.trim()
              }
            >
              {pending
                ? t("sending")
                : remaining > 0
                  ? t("resendIn", { count: remaining })
                  : t("resendVerification")}
            </Button>
          </Stack>
          <Alert severity="info">{t("verificationExpiry")}</Alert>
          <Button href={signInHref}>{t("backSignIn")}</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
