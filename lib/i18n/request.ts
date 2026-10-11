import "server-only";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { cache } from "react";
import {
  getPreferenceIdentity,
  getPreferenceSession,
} from "@/lib/preference-session";
import { prisma } from "@/lib/prisma";
import { localeCookie, resolveLocale } from "./locale";
import { loadMessages } from "./messages";

export const getLocalePreference = cache(async () => {
  const [session, store, requestHeaders] = await Promise.all([
    getPreferenceSession(),
    cookies(),
    headers(),
  ]);
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { uiLocale: true },
      })
    : null;
  const locale = resolveLocale(
    user?.uiLocale,
    store.get(localeCookie)?.value,
    requestHeaders.get("accept-language"),
  );

  return { locale, identity: getPreferenceIdentity(session) };
});

export default getRequestConfig(async () => {
  const { locale } = await getLocalePreference();

  return { locale, messages: await loadMessages(locale), timeZone: "UTC" };
});
