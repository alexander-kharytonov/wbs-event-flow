import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

// This reader has no route handler. Preserve the application's cookie/signature
// configuration without changing the session behavior of the main auth instance.
const preferenceAuth = betterAuth({
  ...auth.options,
  session: { ...auth.options.session, deferSessionRefresh: true },
});

export const getPreferenceSession = cache(async () => {
  const session = await preferenceAuth.api.getSession({
    headers: await headers(),
    // disableRefresh prevents renewal; deferSessionRefresh also prevents expired
    // session cleanup on GET. Both checks still use the signed cookie and DB.
    query: { disableCookieCache: true, disableRefresh: true },
  });

  if (!session || session.session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session;
});

// A continuity check, never an authentication credential. Session authorization
// still comes from Better Auth's signed cookie and current database session.
export function getPreferenceIdentity(
  session: Awaited<ReturnType<typeof getPreferenceSession>>,
) {
  const identity = session ? [session.user.id, session.session.id] : null;

  return createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(`event-flow:preference-identity:v1:${JSON.stringify(identity)}`)
    .digest("base64url");
}

export function matchesPreferenceIdentity(
  supplied: string | null,
  session: Awaited<ReturnType<typeof getPreferenceSession>>,
) {
  if (!supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(supplied),
    Buffer.from(getPreferenceIdentity(session)),
  );
}
