"use client";

import Link from "next/link";
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
        callbackURL: "/",
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
        window.location.assign("/");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <section aria-live="polite">
        <h1>Check your email</h1>
        <p>
          If registration can proceed, a verification email has been sent.
          Follow the link within one hour to verify your email and sign in.
        </p>
        <p>
          This creates your sign-in account only. Organizer setup is not
          available yet.
        </p>
        <Link href="/sign-in">Go to sign in</Link>
      </section>
    );
  }

  return (
    <>
      <h1>{registering ? "Organizer registration" : "Sign in"}</h1>
      {registering && (
        <p>
          Create your sign-in account. Organizer setup will be a separate step.
        </p>
      )}
      <form onSubmit={submit}>
        {registering && (
          <label>
            Name
            <input name="name" autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={10}
            maxLength={128}
            required
            aria-describedby={registering ? "password-policy" : undefined}
          />
        </label>
        {registering && <p id="password-policy">Use 10–128 characters.</p>}
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Please wait…" : registering ? "Register" : "Sign in"}
        </button>
      </form>
      <Link href={registering ? "/sign-in" : "/register"}>
        {registering
          ? "Already registered? Sign in"
          : "Register as an organizer"}
      </Link>
    </>
  );
}
