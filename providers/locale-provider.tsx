"use client";

import { usePathname } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isUiLocale, type UiLocale } from "@/lib/i18n/locale";
import { loadMessages, type Messages } from "@/lib/i18n/messages";

const LocaleContext = createContext<{
  pending: boolean;
  changeLocale: (
    locale: UiLocale,
  ) => Promise<"saved" | "saveFailed" | "syncFailed">;
} | null>(null);

export function LocaleProvider({
  locale,
  messages,
  identity,
  children,
}: {
  locale: UiLocale;
  messages: Messages;
  identity: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState({ locale, messages });
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const authorityIdentity = useRef(identity);
  const busy = useRef(false);
  const generation = useRef(0);
  const writing = useRef(false);
  const reading = useRef<Promise<UiLocale | null> | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  const reconcile = useCallback((): Promise<UiLocale | null> => {
    generation.current++;

    if (writing.current || !mounted.current) {
      return Promise.resolve(null);
    }

    if (reading.current) {
      return reading.current;
    }
    const task = (async () => {
      while (mounted.current && !writing.current) {
        // Batch visibility/pageshow before capturing the authority generation.
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (!mounted.current || writing.current) {
          return null;
        }
        const current = generation.current;

        try {
          const response = await fetch("/api/preferences/locale", {
            cache: "no-store",
          });
          const value: unknown = response.ok ? await response.json() : null;

          if (
            value &&
            typeof value === "object" &&
            "locale" in value &&
            isUiLocale(value.locale) &&
            "identity" in value &&
            typeof value.identity === "string" &&
            /^[A-Za-z0-9_-]{43}$/.test(value.identity)
          ) {
            const next = value.locale;
            const nextMessages = await loadMessages(next);

            if (mounted.current && current === generation.current) {
              authorityIdentity.current = value.identity;
              setState({ locale: next, messages: nextMessages });

              return next;
            }
          }
        } catch {
          // A failed current read retries on the next signal, never by polling.
        }

        if (current === generation.current) {
          return null;
        }
        // A signal during the request requires one fresh read, not its old result.
      }

      return null;
    })();
    reading.current = task;
    void task.finally(() => {
      if (reading.current === task) {
        reading.current = null;
      }
    });

    return task;
  }, []);

  useEffect(() => {
    // RSC props can arrive late or come from the router cache. They are a signal
    // to read current authority, never a replacement for a confirmed selection.
    void locale;
    void messages;
    void identity;
    void pathname;
    void reconcile();

    return () => {
      generation.current++;
    };
  }, [locale, messages, identity, pathname, reconcile]);

  useEffect(() => {
    const refresh = () => void reconcile();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    // Window focus also fires when returning from DevTools. Reconcile only when
    // the page becomes visible again, not when focus moves between UI surfaces.
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reconcile]);

  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  async function changeLocale(next: UiLocale) {
    if (busy.current || !mounted.current) {
      return "saveFailed" as const;
    }
    busy.current = true;
    writing.current = true;
    const current = ++generation.current;
    const expectedIdentity = authorityIdentity.current;
    let saved = false;
    let conflicted = false;
    setPending(true);

    try {
      await loadMessages(next);

      // Signals or unmount during message loading invalidate this unsent choice.
      if (!mounted.current || current !== generation.current) {
        return "saveFailed" as const;
      }
      const response = await fetch("/api/preferences/locale", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Preference-Identity": expectedIdentity,
        },
        body: JSON.stringify(next),
      });

      if (response.status === 409) {
        conflicted = true;
        writing.current = false;
        // Learn current authority, but never replay the old choice for it.
        await reconcile();

        return "saveFailed" as const;
      }

      if (!response.ok) {
        return "saveFailed" as const;
      }
      saved = true;
      writing.current = false;
      // Confirm against the current session, including any signals during PUT.
      // Keep single-flight submission/pending until this reconciliation settles.
      const confirmed = await reconcile();

      return mounted.current &&
        confirmed === next &&
        authorityIdentity.current === expectedIdentity
        ? ("saved" as const)
        : ("syncFailed" as const);
    } catch {
      return saved ? ("syncFailed" as const) : ("saveFailed" as const);
    } finally {
      writing.current = false;
      busy.current = false;
      setPending(false);

      if (!saved && !conflicted && current !== generation.current) {
        void reconcile();
      }
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
