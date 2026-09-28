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

// Each SSE request rechecks the database without extending the session.
export async function getStreamSession(request: Request) {
  const checkedAt = Date.now();
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });

  if (!session || session.session.expiresAt.getTime() <= Date.now()) {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!session.user.emailVerified) {
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return {
    userId: session.user.id,
    deadline: Math.min(checkedAt + 60000, session.session.expiresAt.getTime()),
  };
}
