import "server-only";
import { createTranslator } from "use-intl/core";
import { defaultLocale, isUiLocale } from "./locale";
import { loadMessages } from "./messages";

// Background work has no request/cookie/browser context. Callers supply an
// explicit recipient preference; existing email rendering is intentionally unchanged.

export async function createBackgroundTranslator(preference: unknown) {
  const locale = isUiLocale(preference) ? preference : defaultLocale;

  return createTranslator({ locale, messages: await loadMessages(locale) });
}
