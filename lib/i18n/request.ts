import "server-only";
import { getRequestConfig } from "next-intl/server";
import { getUiPreferences } from "@/lib/ui-preferences";
import { loadMessages } from "./messages";

export default getRequestConfig(async () => {
  const { locale } = await getUiPreferences();

  return { locale, messages: await loadMessages(locale), timeZone: "UTC" };
});
