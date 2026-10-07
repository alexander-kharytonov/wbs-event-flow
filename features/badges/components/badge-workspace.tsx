"use client";

import PrintOutlined from "@mui/icons-material/PrintOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { previewBadge, updateBadgeLayout } from "@/features/badges/actions";
import {
  type BadgeLayout,
  badgeDimensions,
  badgeSizes,
  sameBadgeField,
} from "@/features/badges/badge-layout";
import { Badge } from "@/features/badges/components/badge";
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

  function change<K extends keyof BadgeLayout>(key: K, value: BadgeLayout[K]) {
    setLayout((current) => (current ? { ...current, [key]: value } : current));
    notifications.close(`badge-layout:${eventId}`);
  }

  async function save() {
    if (!layout || busy) {
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
        notifications.show(result.message, {
          severity: "error",
          key: `badge-layout:${eventId}`,
        });
      }
    } catch {
      notifications.show("Could not save. Please try again.", {
        severity: "error",
        key: `badge-layout:${eventId}`,
      });
    } finally {
      setBusy(false);
    }
  }

  function fieldSelect(key: "secondaryField" | "tertiaryField", label: string) {
    if (!layout) {
      return null;
    }

    const binding = layout[key];
    const index = binding
      ? catalog.findIndex((field) => sameBadgeField(field, binding))
      : -1;

    return (
      <TextField
        select
        fullWidth
        label={label}
        value={index < 0 ? "" : String(index)}
        onChange={(event) => {
          if (event.target.value === "") {
            change(key, null);

            return;
          }

          const { fieldId, type, label } = catalog[Number(event.target.value)];
          change(key, { fieldId, type, label });
        }}
      >
        <MenuItem value="">None</MenuItem>
        {catalog.map((field, position) => (
          <MenuItem
            key={`${field.fieldId}:${field.type}:${field.label}`}
            value={String(position)}
            sx={{ whiteSpace: "normal" }}
          >
            {field.label} ·{" "}
            {field.type === "SHORT_TEXT"
              ? "Short text"
              : field.type === "LONG_TEXT"
                ? "Long text"
                : "Single choice"}
            {catalog.some(
              (other) =>
                other.fieldId !== field.fieldId &&
                other.label === field.label &&
                other.type === field.type,
            ) && ` · ${field.context}`}
          </MenuItem>
        ))}
      </TextField>
    );
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  select
                  label="Size"
                  value={layout.size}
                  onChange={(event) =>
                    change("size", event.target.value as BadgeLayout["size"])
                  }
                >
                  {Object.entries(badgeSizes).map(([value, size]) => (
                    <MenuItem key={value} value={value}>
                      {size.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  select
                  label="Padding (mm)"
                  value={layout.paddingMm}
                  onChange={(event) =>
                    change("paddingMm", Number(event.target.value))
                  }
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value} mm
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                  "& .MuiTextField-root": { minWidth: 0 },
                }}
              >
                <TextField
                  fullWidth
                  select
                  label="Orientation"
                  sx={{ gridColumn: { md: "1 / -1", lg: "auto" } }}
                  value={layout.orientation}
                  onChange={(event) =>
                    change(
                      "orientation",
                      event.target.value as BadgeLayout["orientation"],
                    )
                  }
                >
                  <MenuItem value="LANDSCAPE">Landscape</MenuItem>
                  <MenuItem value="PORTRAIT">Portrait</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  select
                  label="Name size"
                  value={layout.nameSize}
                  onChange={(event) =>
                    change(
                      "nameSize",
                      event.target.value as BadgeLayout["nameSize"],
                    )
                  }
                >
                  <MenuItem value="SMALL">Small</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="LARGE">Large</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  select
                  label="Alignment"
                  value={layout.alignment}
                  onChange={(event) =>
                    change(
                      "alignment",
                      event.target.value as BadgeLayout["alignment"],
                    )
                  }
                >
                  <MenuItem value="LEFT">Left</MenuItem>
                  <MenuItem value="CENTER">Center</MenuItem>
                </TextField>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                }}
              >
                {(
                  [
                    ["showEventName", "Event name"],
                    ["showAttendeeType", "Attendee type"],
                    ["showQr", "QR"],
                    ["showTicketNumber", "Ticket number"],
                  ] as const
                ).map(([key, label]) => (
                  <FormControlLabel
                    key={key}
                    label={label}
                    control={
                      <Checkbox
                        checked={layout[key]}
                        onChange={(_, checked) => change(key, checked)}
                      />
                    }
                  />
                ))}
              </Box>
              {fieldSelect("secondaryField", "Secondary field")}
              {fieldSelect("tertiaryField", "Tertiary field")}
              <Alert severity="info">
                Selected values are visible to staff who can print badges,
                including Reception. Guests never inherit these answers.
              </Alert>
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
