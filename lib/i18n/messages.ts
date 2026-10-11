import type { UiLocale } from "./locale";
import enLocale from "./messages/locale/en.json";
import enShell from "./messages/shell/en.json";
import enValidation from "./messages/validation/en.json";

export type Messages = {
  shell: typeof enShell;
  locale: typeof enLocale;
  validation: typeof enValidation;
};

// Flat feature dictionaries merge per key, preserving English for untranslated keys.

export async function loadMessages(locale: UiLocale): Promise<Messages> {
  const [shell, preference, validation] = await Promise.all([
    import(`./messages/shell/${locale}.json`),
    import(`./messages/locale/${locale}.json`),
    import(`./messages/validation/${locale}.json`),
  ]);

  return {
    shell: { ...enShell, ...shell.default },
    locale: { ...enLocale, ...preference.default },
    validation: { ...enValidation, ...validation.default },
  };
}
