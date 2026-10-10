"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const leaveEvent = "event-editor:leave";

// App controls without an href (currently Sign out) join the same confirmation.
export function requestEditorLeave(
  proceed: (navigate: (action: () => void) => void) => void,
) {
  const event = new CustomEvent(leaveEvent, {
    cancelable: true,
    detail: proceed,
  });

  if (window.dispatchEvent(event)) {
    proceed((action) => action());
  }
}

type Guard = {
  register: (key: string, dirty: boolean) => void;
  request: (proceed: () => void) => void;
  confirmed: (proceed: () => void) => void;
};
const Context = createContext<Guard | null>(null);

export function EditorNavigationGuard({
  children,
  description = "Unsaved event fields and pending cover edits will be lost. A cover already saved separately will remain saved.",
}: {
  children: ReactNode;
  description?: string;
}) {
  const dirtySources = useRef(new Set<string>());
  const leaving = useRef(false);
  const destination = useRef<(() => void) | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const register = useCallback((key: string, dirty: boolean) => {
    if (dirty) {
      dirtySources.current.add(key);
    } else {
      dirtySources.current.delete(key);
    }
  }, []);
  const request = useCallback((proceed: () => void) => {
    // Reserve synchronously: later requests must not replace or queue an action.
    if (destination.current) {
      return;
    }

    if (dirtySources.current.size && !leaving.current) {
      destination.current = proceed;
      setConfirmationOpen(true);
    } else {
      proceed();
    }
  }, []);
  const cancelConfirmation = useCallback(() => {
    destination.current = null;
    setConfirmationOpen(false);
  }, []);
  const confirmDestination = useCallback(() => {
    const proceed = destination.current;
    cancelConfirmation();
    proceed?.();
  }, [cancelConfirmation]);
  const confirmed = useCallback((proceed: () => void) => {
    leaving.current = true;
    dirtySources.current.clear();
    proceed();
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtySources.current.size && !leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    function customLeave(event: Event) {
      event.preventDefault();
      request(() =>
        (
          event as CustomEvent<(navigate: (action: () => void) => void) => void>
        ).detail(confirmed),
      );
    }
    function click(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !dirtySources.current.size ||
        leaving.current
      ) {
        return;
      }

      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;

      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      ) {
        return;
      }

      const destination = new URL(link.href, window.location.href);

      if (
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      request(() => confirmed(() => window.location.assign(link.href)));
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(leaveEvent, customLeave);
    document.addEventListener("click", click, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(leaveEvent, customLeave);
      document.removeEventListener("click", click, true);
    };
  }, [request, confirmed]);

  return (
    <Context.Provider value={{ register, request, confirmed }}>
      {children}
      <Dialog
        open={confirmationOpen}
        onClose={cancelConfirmation}
        aria-labelledby="editor-discard-title"
        aria-describedby="editor-discard-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="editor-discard-title">
          Discard unsaved changes?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="editor-discard-description">
            {description}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={cancelConfirmation}>
            Keep editing
          </Button>
          <Button color="error" onClick={confirmDestination}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    </Context.Provider>
  );
}

export function useEditorNavigation() {
  const context = useContext(Context);

  if (!context) {
    throw new Error("Editor navigation requires EditorNavigationGuard.");
  }

  return context;
}

export function useEditorDirty(key: string, dirty: boolean) {
  const { register } = useEditorNavigation();
  useEffect(() => {
    register(key, dirty);

    return () => register(key, false);
  }, [register, key, dirty]);
}
