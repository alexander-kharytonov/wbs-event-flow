import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  getPreferenceIdentity,
  getPreferenceSession,
} from "@/lib/preference-session";
import { prisma } from "@/lib/prisma";
import { modeCookie, resolveUiMode } from "@/lib/ui-mode";

// Request-scoped only. Read the current preference, never the auth cookie cache.
export const getUiModePreference = cache(async () => {
  const [session, store] = await Promise.all([
    getPreferenceSession(),
    cookies(),
  ]);
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { uiMode: true },
      })
    : null;

  return {
    mode: resolveUiMode(user?.uiMode, store.get(modeCookie)?.value),
    identity: getPreferenceIdentity(session),
  };
});
