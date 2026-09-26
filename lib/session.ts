import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { safeReturnPath } from "./safe-return-path";

// React cache deduplicates lookups only within the current server render.
export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
});

export async function requireVerifiedUser() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.user.emailVerified) {
    redirect("/sign-in?verification=required");
  }

  return session.user;
}

// Auth screens remain available to users who still need email verification.
export async function redirectVerifiedUser(returnTo: unknown) {
  const session = await getSession();

  if (!session?.user.emailVerified) {
    return;
  }

  const destination = safeReturnPath(returnTo);
  const pathname = destination
    ? decodeURIComponent(
        new URL(destination, "https://event-flow.invalid").pathname,
      ).replace(/\/+$/, "")
    : "";
  const isAuthPage = ["/sign-in", "/register", "/verify-email"].includes(
    pathname,
  );

  // A returnTo pointing at an auth screen would bounce between these guards.
  redirect(destination && !isAuthPage ? destination : "/account");
}
