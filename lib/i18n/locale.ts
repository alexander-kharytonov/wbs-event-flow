export const locales = ["en", "de", "pl", "uk", "ru"] as const;

export type UiLocale = (typeof locales)[number];

export const defaultLocale: UiLocale = "en";

export const localeCookie = "event-flow-locale";

export const localeNames: Record<UiLocale, string> = {
  en: "English",
  de: "Deutsch",
  pl: "Polski",
  uk: "Українська",
  ru: "Русский",
};

export function isUiLocale(value: unknown): value is UiLocale {
  return (
    typeof value === "string" && locales.some((locale) => locale === value)
  );
}

export function browserLocale(header: string | null): UiLocale {
  const preferences = (header ?? "")
    .slice(0, 4096)
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const raw = quality?.trim().slice(2);
      const weight =
        raw === undefined
          ? 1
          : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw)
            ? Number(raw)
            : 0;
      const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(tag)
        ? tag.toLowerCase().split("-")[0]
        : undefined;

      return { language, weight };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight);

  return (
    (preferences.find(({ language }) => isUiLocale(language))?.language as
      | UiLocale
      | undefined) ?? defaultLocale
  );
}

export function resolveLocale(
  account: unknown,
  cookie: unknown,
  browser: string | null,
): UiLocale {
  if (isUiLocale(account)) {
    return account;
  }

  if (isUiLocale(cookie)) {
    return cookie;
  }

  return browserLocale(browser);
}
