import { useRef, useState } from "react";

// The password stays in the input, never in React state or persistent storage.
export function useEventPasswordDraft(initialPasswordProtected: boolean) {
  const passwordInput = useRef<HTMLInputElement>(null);
  const [passwordEnabled, setPasswordEnabled] = useState(
    initialPasswordProtected,
  );
  const [passwordSaved, setPasswordSaved] = useState(initialPasswordProtected);
  const [passwordFilled, setPasswordFilled] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);

  function clearDraft() {
    if (passwordInput.current) passwordInput.current.value = "";
    setPasswordFilled(false);
    setPasswordDirty(false);
  }

  function adoptSaved(protectedEvent: boolean) {
    setPasswordSaved(protectedEvent);
    setPasswordEnabled(protectedEvent);
  }

  function toggle(enabled: boolean) {
    setPasswordEnabled(enabled);
    clearDraft();
  }

  function inputChanged() {
    setPasswordFilled(Boolean(passwordInput.current?.value));
    setPasswordDirty(Boolean(passwordInput.current?.value));
  }

  return {
    passwordInput,
    passwordEnabled,
    passwordSaved,
    passwordFilled,
    passwordDirty,
    clearDraft,
    adoptSaved,
    toggle,
    inputChanged,
  };
}
