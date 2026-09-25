"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setPending(true);
    setError("");

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setError("Could not sign out. Please try again.");

        return;
      }

      window.location.assign("/");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={signOut} disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
