import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { localeCookie, resolveLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { modeCookie, resolveUiMode } from "@/lib/ui-mode";

// One account read per server render; cookies never authorize account updates.
export const getUiPreferences = cache(async () => {
  const [session, store, requestHeaders] = await Promise.all([
    getSession(),
    cookies(),
    headers(),
  ]);
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { uiLocale: true, uiMode: true },
      })
    : null;

  return {
    locale: resolveLocale(
      user?.uiLocale,
      store.get(localeCookie)?.value,
      requestHeaders.get("accept-language"),
    ),
    mode: resolveUiMode(user?.uiMode, store.get(modeCookie)?.value),
  };
});
