import { z } from "zod";

// Event content language is a domain value, independent of UI preferences.
export const eventLanguages = ["en", "de", "pl", "uk", "ru"] as const;

// Availability in selectors does not change the supported content contract.
export const selectableEventLanguages = eventLanguages.filter(
  (language) => language !== "ru",
);

export const eventLanguageSchema = z.enum(eventLanguages, {
  error: "invalidEventLanguage",
});

export type EventLanguage = z.infer<typeof eventLanguageSchema>;

export const eventLanguageNames: Record<EventLanguage, string> = {
  en: "English",
  de: "Deutsch",
  pl: "Polski",
  uk: "Українська",
  ru: "Русский",
};
