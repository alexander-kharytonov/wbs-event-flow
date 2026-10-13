import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CoverSource } from "@/features/events/components/cover-cropper";
import { EventText } from "@/features/events/components/event-text";
import { initialCoverCrop } from "@/features/events/cover-crop";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

export type EditableCover = { assetId: string | null; alt: string | null };
export type EventCoverOptions = {
  eventId?: string;
  initial: EditableCover;
  version: string;
  disabled: boolean;
  begin: () => boolean;
  end: () => void;
  onSaved: (version: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onConflictChange: (conflict: boolean) => void;
  onUnpreparedChange?: (unprepared: boolean) => void;
  onPreparedChange?: (assetId: string | null) => void;
};

export function useEventCover({
  eventId,
  initial,
  version,
  disabled,
  begin,
  end,
  onSaved,
  onDirtyChange,
  onConflictChange,
  onUnpreparedChange,
  onPreparedChange,
}: EventCoverOptions) {
  const t = useTranslations("events");
  const [progress, setProgress] = useState(0);
  const [cover, setCover] = useState(initial);
  const [assetId, setAssetId] = useState(initial.assetId);
  const [alt, setAlt] = useState(initial.alt ?? "");
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState<"select" | "upload" | "save" | null>(
    null,
  );
  const [source, setSource] = useState<CoverSource | null>(null);
  const [crop, setCrop] = useState(initialCoverCrop);
  const selection = useRef(0);
  const notifications = useNotifications();
  const [conflict, setConflict] = useState(false);
  const request = useRef<AbortController | null>(null);
  const feedback = useFormFeedback<keyof Messages["events"]>({}, (code) =>
    t(code),
  );
  useEffect(
    () => () => {
      request.current?.abort();
      selection.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (source) {
        URL.revokeObjectURL(source.url);
      }
    },
    [source],
  );

  function showError(code: keyof Messages["events"]) {
    notifications.show(<EventText id={code} />, {
      severity: "error",
      key: `cover-error:${eventId ?? "new"}:${code}`,
    });
  }

  async function selectFile(next: File | undefined) {
    if (!next || disabled || pending) {
      return;
    }

    feedback.reset();

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
      next.size > 5 * 1024 * 1024
    ) {
      showError("coverChooseValid");

      return;
    }

    if (!begin()) {
      return;
    }

    const current = ++selection.current;
    setPending("select");

    try {
      const bitmap = await createImageBitmap(next, {
        imageOrientation: "from-image",
      });
      const { width, height } = bitmap;
      bitmap.close();

      if (current !== selection.current) {
        return;
      }

      if (width > 4096 || height > 4096 || width < 16 || height < 9) {
        showError("coverDimensions");

        return;
      }

      setSource({ url: URL.createObjectURL(next), width, height });
      setFile(next);
      setCrop(initialCoverCrop);
    } catch {
      if (current === selection.current) {
        showError("coverOpenFailed");
      }
    } finally {
      if (current === selection.current) {
        setPending(null);
        end();
      }
    }
  }

  async function uploadTemporary(controller: AbortController) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/event-covers/uploads");
      xhr.timeout = 90_000;
      xhr.setRequestHeader("Content-Type", file?.type ?? "");
      xhr.setRequestHeader("X-Event-Cover-Crop", JSON.stringify(crop));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          setProgress(Math.round((event.loaded / event.total) * 100));
      };
      const abort = () => xhr.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      xhr.onloadend = () =>
        controller.signal.removeEventListener("abort", abort);
      xhr.onload = () =>
        resolve(new Response(xhr.responseText, { status: xhr.status }));
      xhr.onerror =
        xhr.ontimeout =
        xhr.onabort =
          () => reject(new Error("Upload unconfirmed"));
      xhr.send(file);
    });
  }

  async function removeTemporary() {
    if (disabled || pending || !begin()) {
      return;
    }
    setPending("save");
    feedback.reset();

    try {
      if (assetId) {
        const response = await fetch(`/api/event-covers/${assetId}`, {
          method: "DELETE",
        });

        if (!response.ok && response.status !== 404) {
          showError("coverSaveFailed");

          return;
        }
      }
      setAssetId(null);
      setAlt("");
      setFile(undefined);
      setSource(null);
    } catch {
      showError("coverConfirmFailed");
    } finally {
      setPending(null);
      end();
    }
  }

  async function mutate(kind: "upload" | "save", remove = false) {
    if (disabled || pending || (kind === "upload" && !file)) {
      return;
    }
    feedback.reset();

    if (kind === "save" && !remove && alt.trim().length > 500) {
      feedback.setErrors({ alt: "coverAltLong" });

      return;
    }

    if (!begin()) {
      return;
    }
    setPending(kind);
    setProgress(0);
    const controller = new AbortController();
    request.current = controller;

    try {
      const response =
        !eventId && kind === "upload"
          ? await uploadTemporary(controller)
          : await fetch(
              `/api/events/${eventId}/cover${kind === "upload" ? "/uploads" : ""}`,
              {
                method: kind === "upload" ? "POST" : "PUT",
                headers: {
                  "Content-Type":
                    kind === "upload" ? (file?.type ?? "") : "application/json",
                  ...(kind === "upload"
                    ? { "X-Event-Cover-Crop": JSON.stringify(crop) }
                    : {}),
                },
                body:
                  kind === "upload"
                    ? file
                    : JSON.stringify({
                        assetId: remove ? null : assetId,
                        alt: remove || !assetId ? null : alt.trim() || null,
                        version,
                      }),
                signal: controller.signal,
              },
            );
      const result = await response.json();

      if (!response.ok) {
        if (eventId && response.status === 409) {
          setConflict(true);
        }
        showError(
          typeof result.code === "string" &&
            t.has(result.code as keyof Messages["events"])
            ? (result.code as keyof Messages["events"])
            : "coverSaveFailed",
        );

        return;
      }

      if (kind === "upload") {
        if (!eventId && assetId) {
          // A failed discard stays tracked and expires automatically.
          void fetch(`/api/event-covers/${assetId}`, {
            method: "DELETE",
          }).catch(() => {});
        }
        setAssetId(result.assetId);
        setFile(undefined);
        setSource(null);
      } else {
        const next = {
          assetId: remove ? null : assetId,
          alt: remove ? null : alt.trim() || null,
        };
        setCover(next);
        setAssetId(next.assetId);
        setAlt(next.alt ?? "");
        setFile(undefined);
        setSource(null);
        onSaved(result.version);
        notifications.show(
          <EventText id={remove ? "coverRemoved" : "coverSaved"} />,
          {
            severity: "success",
            autoHideDuration: 5000,
            key: `cover:${eventId}`,
          },
        );
        setConflict(false);
      }
    } catch {
      if (!controller.signal.aborted) {
        showError("coverConfirmFailed");
      }
    } finally {
      setPending(null);
      end();
    }
  }

  const busy = disabled || Boolean(pending);
  const changed =
    assetId !== cover.assetId || (alt.trim() || null) !== cover.alt;
  useEffect(() => {
    onDirtyChange(changed || Boolean(source));
  }, [changed, source, onDirtyChange]);
  useEffect(() => {
    onConflictChange(conflict);
  }, [conflict, onConflictChange]);
  useEffect(() => {
    onUnpreparedChange?.(Boolean(source));
  }, [source, onUnpreparedChange]);
  useEffect(() => {
    onPreparedChange?.(assetId);
  }, [assetId, onPreparedChange]);

  function discardUpload() {
    setAssetId(cover.assetId);
    setAlt(cover.alt ?? "");
    feedback.reset();
  }

  function changeAlt(value: string) {
    setAlt(value);
    feedback.clear("alt");
  }

  return {
    progress,
    cover,
    assetId,
    alt,
    file,
    pending,
    source,
    crop,
    setCrop,
    conflict,
    feedback,
    busy,
    changed,
    selectFile,
    mutate,
    removeTemporary,
    discardUpload,
    changeAlt,
  };
}
