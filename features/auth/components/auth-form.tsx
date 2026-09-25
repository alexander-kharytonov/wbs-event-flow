"use client";

import {
  Alert,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({
  mode,
  notice,
}: {
  mode: "register" | "sign-in";
  notice?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const registering = mode === "register";

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");

    try {
      const credentials = {
        email: String(form.get("email")),
        password: String(form.get("password")),
        callbackURL: "/onboarding/organizer",
      };
      const result = registering
        ? await authClient.signUp.email({
            ...credentials,
            name: String(form.get("name")),
          })
        : await authClient.signIn.email(credentials);

      if (result.error) {
        setError(
          result.error.code === "EMAIL_NOT_VERIFIED"
            ? "Verify your email before signing in. Check your inbox for a verification link."
            : "Unable to complete the request. Check your details and try again. If registration previously failed, try signing in to receive a new verification email.",
        );

        return;
      }

      if (registering) {
        setSent(true);
      } else {
        window.location.assign("/dashboard");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
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
        {sent ? (
          <Stack spacing={3} component="section" aria-live="polite">
            <Stack spacing={1}>
              <Typography variant="h4" component="h1">
                Check your email
              </Typography>
              <Typography color="text.secondary">
                One more step to get started.
              </Typography>
            </Stack>
            <Alert severity="info">
              If this email can be registered, we sent a verification link.
              Follow the link within one hour. If you already have an account,
              sign in.
            </Alert>
            <Button href="/sign-in" variant="contained">
              Go to sign in
            </Button>
          </Stack>
        ) : (
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h4" component="h1">
                {registering ? "Create your account" : "Welcome back"}
              </Typography>
              <Typography color="text.secondary">
                {registering
                  ? "Register as an organizer to start planning your events."
                  : "Sign in to manage your events."}
              </Typography>
            </Stack>
            {notice && <Alert severity="info">{notice}</Alert>}
            <Stack
              component="form"
              spacing={2.5}
              onSubmit={submit}
              aria-busy={pending}
            >
              {registering && (
                <TextField
                  label="Name"
                  name="name"
                  autoComplete="name"
                  required
                  fullWidth
                />
              )}
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                slotProps={{ htmlInput: { minLength: 10, maxLength: 128 } }}
                helperText={registering ? "Use 10–128 characters." : undefined}
                required
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : registering
                    ? "Create account"
                    : "Sign in"}
              </Button>
              {registering && (
                <Typography variant="body2" color="text.secondary">
                  We’ll send a verification link to your email before you can
                  start.
                </Typography>
              )}
            </Stack>
            <Divider />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center" }}
            >
              {registering
                ? "Already have an account? "
                : "New to Event Flow? "}
              <Link href={registering ? "/sign-in" : "/register"}>
                {registering ? "Sign in" : "Register as an organizer"}
              </Link>
            </Typography>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
