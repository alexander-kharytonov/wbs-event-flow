"use client";

import { useColorScheme } from "@mui/material/styles";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isUiMode, type UiMode } from "@/lib/ui-mode";

const ModeContext = createContext<{
  mode: UiMode;
  pending: boolean;
  changeMode: (mode: UiMode) => Promise<"saved" | "saveFailed" | "syncFailed">;
} | null>(null);

export function ModePreferenceProvider({
  preference,
  children,
}: {
  preference: { mode: UiMode; identity: string };
  children: React.ReactNode;
}) {
  const { mode, setMode } = useColorScheme();
  const [initialMode] = useState(preference.mode);
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const authorityIdentity = useRef(preference.identity);
  const busy = useRef(false);
  const generation = useRef(0);
  const writing = useRef(false);
  const reading = useRef<Promise<UiMode | null> | null>(null);
  const mounted = useRef(false);
  const applyMode = useRef(setMode);

  // MUI's development wrapper changes identity with the active color scheme.
  // An OS/theme change must not itself trigger a preference read.
  useEffect(() => {
    applyMode.current = setMode;
  }, [setMode]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  const reconcile = useCallback((): Promise<UiMode | null> => {
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
          const response = await fetch("/api/preferences/mode", {
            cache: "no-store",
          });
          const value: unknown = response.ok ? await response.json() : null;

          if (
            value &&
            typeof value === "object" &&
            "mode" in value &&
            isUiMode(value.mode) &&
            "identity" in value &&
            typeof value.identity === "string" &&
            /^[A-Za-z0-9_-]{43}$/.test(value.identity)
          ) {
            const next = value.mode;

            if (mounted.current && current === generation.current) {
              authorityIdentity.current = value.identity;
              applyMode.current(next);

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
    void preference;
    void pathname;
    void reconcile();

    return () => {
      generation.current++;
    };
  }, [preference, pathname, reconcile]);

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

  async function changeMode(next: UiMode) {
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
      const response = await fetch("/api/preferences/mode", {
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
    <ModeContext value={{ mode: mode ?? initialMode, pending, changeMode }}>
      {children}
    </ModeContext>
  );
}

export function useModePreference() {
  const context = useContext(ModeContext);

  if (!context) {
    throw new Error("ModePreferenceProvider is required");
  }

  return context;
}
