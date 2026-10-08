"use client";

import PrintOutlined from "@mui/icons-material/PrintOutlined";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { previewBadge, updateBadgeLayout } from "@/features/badges/actions";
import {
  badgeDimensions,
  badgeLayoutSchema,
  validBadgeBindings,
} from "@/features/badges/badge-layout";
import { Badge } from "@/features/badges/components/badge";
import { BadgeLayoutControls } from "@/features/badges/components/badge-layout-controls";
import { badgeCss } from "@/features/badges/components/badge-styles";
import type { buildBadgePresentation } from "@/features/badges/server/badges";
import { useNotifications } from "@/hooks/use-notifications";

type Preview = NonNullable<Awaited<ReturnType<typeof buildBadgePresentation>>>;

export function BadgeWorkspace({
  eventId,
  initial,
}: {
  eventId: string;
  initial: Preview;
}) {
  const notifications = useNotifications();
  const [preview, setPreview] = useState(initial);
  const [layout, setLayout] = useState(initial.editor?.layout ?? null);
  const [savedLayout, setSavedLayout] = useState(
    initial.editor?.layout ?? null,
  );
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const sequence = useRef(0);
  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);
  const catalog = initial.editor?.fields ?? [];
  const previewContainer = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const dimensions = badgeDimensions(preview.presentation.style);
  const widthPx = (dimensions.width * 96) / 25.4;
  const heightPx = (dimensions.height * 96) / 25.4;
  const scale = previewWidth === null ? 1 : Math.min(1, previewWidth / widthPx);

  useEffect(() => {
    const container = previewContainer.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(([entry]) =>
      setPreviewWidth(entry.contentRect.width),
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!layout) {
      return;
    }

    const request = ++sequence.current;
    setPreviewBusy(true);
    notifications.close(`badge-preview:${eventId}`);
    const timer = setTimeout(() => {
      void previewBadge(eventId, layout)
        .then((result) => {
          if (request !== sequence.current) {
            return;
          }

          setPreviewBusy(false);

          if (result) {
            setPreview(result);
          } else {
            notifications.show(
              "Preview unavailable. Reload to check your access and current settings.",
              { severity: "error", key: `badge-preview:${eventId}` },
            );
          }
        })
        .catch(() => {
          if (request === sequence.current) {
            setPreviewBusy(false);
            notifications.show(
              "Could not refresh the preview. Please try again.",
              {
                severity: "error",
                key: `badge-preview:${eventId}`,
              },
            );
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      sequence.current += 1;
      notifications.close(`badge-preview:${eventId}`);
    };
  }, [eventId, layout, notifications]);

  async function save() {
    if (!layout || busy) {
      return;
    }

    setSaveError(undefined);

    if (
      !badgeLayoutSchema.safeParse(layout).success ||
      !validBadgeBindings(layout, catalog)
    ) {
      setSaveError(
        "Check the layout settings and select compatible question bindings.",
      );

      return;
    }

    setBusy(true);
    notifications.close(`badge-layout:${eventId}`);

    try {
      const result = await updateBadgeLayout({ eventId, layout });

      if (result.success) {
        setSavedLayout(layout);
        notifications.show(result.message, {
          severity: "success",
          autoHideDuration: 4000,
          key: `badge-layout:${eventId}`,
        });
      } else {
        setSaveError(result.message);
      }
    } catch {
      setSaveError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        {layout
          ? "Layout changes apply to new print documents after saving; publishing is not required."
          : "Preview the saved layout and open an individual print document."}{" "}
        Preview QR areas are placeholders. Actual print documents may contain a
        private Ticket QR.
      </Alert>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: layout ? "minmax(300px, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
          },
          gap: 3,
          alignItems: "start",
        }}
      >
        {layout && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack
              spacing={2.5}
              component="fieldset"
              disabled={busy}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
            >
              <Typography variant="h6" component="legend">
                Settings
              </Typography>
              <BadgeLayoutControls
                layout={layout}
                catalog={catalog}
                onChange={(next) => {
                  setLayout(next);
                  setSaveError(undefined);
                  notifications.close(`badge-layout:${eventId}`);
                }}
              />
              {saveError && <Alert severity="error">{saveError}</Alert>}
              <Button
                variant="contained"
                loading={busy}
                disabled={!dirty}
                onClick={save}
                sx={{ alignSelf: "flex-start" }}
              >
                Save changes
              </Button>
            </Stack>
          </Paper>
        )}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              {layout ? "Live preview" : "Saved layout preview"}
            </Typography>
            {(preview.editor?.bindingWarnings.length ?? 0) > 0 && (
              <Alert severity="warning">
                Some historical registrations have incompatible or unavailable
                selected questions. Those values will be omitted; no automatic
                remapping occurs.
              </Alert>
            )}
            {preview.editor?.issues.map((issue) => (
              <Alert key={issue.slot} severity="warning">
                The {issue.slot} field is{" "}
                {issue.reason === "INCOMPATIBLE"
                  ? "incompatible with this attendee’s submitted question"
                  : "unavailable"}{" "}
                and will not be printed.
              </Alert>
            ))}
            <Box
              ref={previewContainer}
              aria-busy={previewBusy}
              sx={{
                overflowX: "auto",
                py: 2,
                bgcolor: "action.hover",
                borderRadius: 1,
              }}
            >
              <Box
                sx={{
                  width: widthPx * scale,
                  height: heightPx * scale,
                  mx: "auto",
                }}
              >
                <Box
                  sx={{
                    width: widthPx,
                    height: heightPx,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    boxShadow: 1,
                  }}
                >
                  <style>{badgeCss}</style>
                  <Badge badge={preview.presentation} />
                </Box>
              </Box>
            </Box>
            <Alert severity="info">
              {previewBusy
                ? "Updating preview…"
                : preview.attendeeId
                  ? "Preview uses an active attendee. Text is limited to two lines per field."
                  : "No active attendee is available. This preview uses field labels only."}
              {dirty && " Save changes before opening the print document."}
            </Alert>
            {preview.canPrint && preview.attendeeId ? (
              <Button
                variant="outlined"
                startIcon={<PrintOutlined />}
                href={`/print/events/${eventId}/badges/${preview.attendeeId}`}
                target="_blank"
                rel="noopener noreferrer"
                disabled={dirty || busy || previewBusy}
                sx={{ alignSelf: "flex-start" }}
              >
                Open print document
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Printing requires an active attendee and a non-cancelled event.
              </Typography>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
