"use client";

import {
  Alert,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "register" | "sign-in" }) {
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

  if (sent) {
    return (
      <Stack spacing={2} component="section" aria-live="polite">
        <Typography variant="h4" component="h1">
          Check your email
        </Typography>
        <Alert severity="info">
          If this email can be registered, we sent a verification link. Follow
          the link within one hour. If you already have an account, sign in.
        </Alert>
        <Link href="/sign-in">Go to sign in</Link>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        {registering ? "Organizer registration" : "Sign in"}
      </Typography>
      {registering && (
        <Typography color="text.secondary">
          Create your account and verify your email to get started as an
          organizer.
        </Typography>
      )}
      <Stack component="form" spacing={2} onSubmit={submit}>
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
          {pending ? "Please wait…" : registering ? "Register" : "Sign in"}
        </Button>
      </Stack>
      <Link href={registering ? "/sign-in" : "/register"}>
        {registering
          ? "Already registered? Sign in"
          : "Register as an organizer"}
      </Link>
    </Stack>
  );
}
