import { safeReturnPath } from "@/lib/safe-return-path";

export const verificationEmailKey = "event-flow:verification-email";
export const verificationCooldownKey = "event-flow:verification-cooldown";

export function verificationPath(returnTo?: string) {
  const destination = safeReturnPath(returnTo);

  return `/verify-email${destination ? `?${new URLSearchParams({ returnTo: destination })}` : ""}`;
}

export function verificationCallbackURL(returnTo?: string) {
  const query = new URLSearchParams({ completed: "1" });
  const destination = safeReturnPath(returnTo);

  if (destination) {
    query.set("returnTo", destination);
  }

  return `/verify-email?${query}`;
}

export function rememberVerificationEmail(email: string) {
  try {
    sessionStorage.setItem(verificationEmailKey, email);
  } catch {
    // The verification page also works when browser storage is unavailable.
  }
}
