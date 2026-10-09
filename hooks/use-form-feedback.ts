"use client";

import { useState } from "react";

// Errors belong to the submitted values and clear when that field is edited.
export function useFormFeedback(initialErrors: Record<string, string> = {}) {
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [message, setMessage] = useState<string>();

  function clear(field: string) {
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key === field || key.startsWith(`${field}.`)) {
          delete next[key];
        }
      }

      return next;
    });
    setMessage(undefined);
  }

  function reset() {
    setErrors({});
    setMessage(undefined);
  }

  function field(name: string) {
    return { error: Boolean(errors[name]), helperText: errors[name] };
  }

  return { errors, setErrors, message, setMessage, clear, reset, field };
}
