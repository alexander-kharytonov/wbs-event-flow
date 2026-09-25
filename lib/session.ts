import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

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
