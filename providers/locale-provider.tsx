"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { UiLocale } from "@/lib/i18n/locale";
import { loadMessages, type Messages } from "@/lib/i18n/messages";

const LocaleContext = createContext<{
  pending: boolean;
  changeLocale: (locale: UiLocale) => Promise<"saved" | "saveFailed">;
} | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: UiLocale;
  messages: Messages;
  children: React.ReactNode;
}) {
  // Server props initialize this document; later renders do not replace a choice.
  const [state, setState] = useState({ locale, messages });
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  async function changeLocale(next: UiLocale) {
    if (busy.current) {
      return "saveFailed" as const;
    }
    busy.current = true;
    setPending(true);

    try {
      const nextMessages = await loadMessages(next);
      const response = await fetch("/api/preferences/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!response.ok) {
        return "saveFailed" as const;
      }
      setState({ locale: next, messages: nextMessages });

      return "saved" as const;
    } catch {
      return "saveFailed" as const;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <LocaleContext value={{ pending, changeLocale }}>
      <NextIntlClientProvider
        locale={state.locale}
        messages={state.messages}
        timeZone="UTC"
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext>
  );
}

export function useLocalePreference() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("LocaleProvider is required");
  }

  return context;
}
