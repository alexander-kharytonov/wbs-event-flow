import type { UiLocale } from "./locale";
import enAuth from "./messages/auth/en.json";
import enEmail from "./messages/email/en.json";
import enEvents from "./messages/events/en.json";
import enLanding from "./messages/landing/en.json";
import enLocale from "./messages/locale/en.json";
import enShell from "./messages/shell/en.json";
import enValidation from "./messages/validation/en.json";

export type Messages = {
  email: typeof enEmail;
  landing: typeof enLanding;
  auth: typeof enAuth;
  events: typeof enEvents;
  shell: typeof enShell;
  locale: typeof enLocale;
  validation: typeof enValidation;
};

// Flat feature dictionaries merge per key, preserving English for untranslated keys.

export async function loadMessages(locale: UiLocale): Promise<Messages> {
  const [shell, preference, validation, auth, events, landing, email] =
    await Promise.all([
      import(`./messages/shell/${locale}.json`),
      import(`./messages/locale/${locale}.json`),
      import(`./messages/validation/${locale}.json`),
      import(`./messages/auth/${locale}.json`),
      import(`./messages/events/${locale}.json`),
      import(`./messages/landing/${locale}.json`),
      import(`./messages/email/${locale}.json`),
    ]);

  return {
    email: { ...enEmail, ...email.default },
    landing: { ...enLanding, ...landing.default },
    auth: { ...enAuth, ...auth.default },
    events: { ...enEvents, ...events.default },
    shell: { ...enShell, ...shell.default },
    locale: { ...enLocale, ...preference.default },
    validation: { ...enValidation, ...validation.default },
  };
}
