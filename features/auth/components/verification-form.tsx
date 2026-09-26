"use client";

import {
  Alert,
  Button,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import {
  rememberVerificationEmail,
  startVerificationCooldown,
  verificationCallbackURL,
  verificationCooldownKey,
  verificationEmailKey,
} from "@/features/auth/verification-flow";
import { authClient } from "@/lib/auth-client";
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
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [cooldownLoaded, setCooldownLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{
    severity: "info" | "error";
    message: string;
  }>();
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

    inFlight.current = true;
    setPending(true);
    setFeedback(undefined);
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

        setFeedback({
          severity: "error",
          message:
            result.error.status === 429
              ? "Please wait before requesting another email."
              : "Could not send the verification email. Please try again.",
        });

        return;
      }

      startCooldown();
      setFeedback({
        severity: "info",
        message:
          "If this account needs verification, a new link has been sent. Check your inbox and spam folder.",
      });
    } catch {
      setFeedback({
        severity: "error",
        message:
          "Could not confirm email delivery. Check your connection and try again.",
      });
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
      <Link href="/" sx={{ alignSelf: "flex-start" }}>
        Back to home
      </Link>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              Verify your email
            </Typography>
            <Typography color="text.secondary">
              Open the link in your latest verification email to continue. If
              you can’t find it, check your spam folder or request a new link
              below.
            </Typography>
          </Stack>
          {invalidLink && !feedback && (
            <Alert severity="warning">
              This verification link is invalid, expired, or already used. Open
              the latest verification email or request a new one below.
            </Alert>
          )}
          {deliveryFailed && !feedback && (
            <Alert severity="error">
              We couldn’t confirm that your verification email was sent. You can
              request a new link below.
            </Alert>
          )}
          {feedback && (
            <Alert severity={feedback.severity}>{feedback.message}</Alert>
          )}
          <Stack
            component="form"
            onSubmit={resend}
            spacing={2}
            aria-busy={pending}
          >
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              disabled={!cooldownLoaded || pending || remaining > 0}
            >
              {pending
                ? "Sending…"
                : remaining > 0
                  ? `Resend in ${remaining}s`
                  : "Resend verification email"}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Verification links expire after one hour. If your email is already
            verified, return to sign in.
          </Typography>
          <Button href={signInHref}>Back to sign in</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
