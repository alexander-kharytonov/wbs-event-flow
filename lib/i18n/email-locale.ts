import "server-only";
import { z } from "zod";
import { defaultLocale, isUiLocale, locales, type UiLocale } from "./locale";

// Read only the language: damaged unrelated fields must not block rejection.
const historicalLanguage = z.object({ language: z.enum(locales) });

export function recipientEmailLocale(
  user: { uiLocale: string | null } | null,
  revisionSnapshot: unknown,
): UiLocale {
  if (user) {
    return isUiLocale(user.uiLocale) ? user.uiLocale : defaultLocale;
  }

  const parsed = historicalLanguage.safeParse(revisionSnapshot);

  return parsed.success ? parsed.data.language : defaultLocale;
}
