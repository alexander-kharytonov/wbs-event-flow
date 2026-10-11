export const uiModes = ["light", "dark", "system"] as const;

export type UiMode = (typeof uiModes)[number];

export const modeCookie = "event-flow-mode";

export function isUiMode(value: unknown): value is UiMode {
  return typeof value === "string" && uiModes.some((mode) => mode === value);
}

export function resolveUiMode(account: unknown, cookie: unknown): UiMode {
  if (isUiMode(account)) {
    return account;
  }

  return isUiMode(cookie) ? cookie : "system";
}
