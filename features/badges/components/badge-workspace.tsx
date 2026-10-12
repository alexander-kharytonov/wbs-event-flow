"use client";

import PrintOutlined from "@mui/icons-material/PrintOutlined";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
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
import { EventText } from "@/features/events/components/event-text";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

type Preview = NonNullable<Awaited<ReturnType<typeof buildBadgePresentation>>>;

export function BadgeWorkspace({
  eventId,
  initial,
}: {
  eventId: string;
  initial: Preview;
}) {
  const t = useTranslations("events");
  const notifications = useNotifications();
  const [previewKind, setPreviewKind] = useState<"PRIMARY" | "GUEST">(
    "PRIMARY",
  );
  const [preview, setPreview] = useState(initial);
  const [layout, setLayout] = useState(initial.editor?.layout ?? null);
  const [savedLayout, setSavedLayout] = useState(
    initial.editor?.layout ?? null,
  );
  const [saveError, setSaveError] = useState<keyof Messages["events"]>();
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
      void previewBadge(eventId, layout, previewKind)
        .then((result) => {
          if (request !== sequence.current) {
            return;
          }

          setPreviewBusy(false);

          if (result) {
            setPreview(result);
          } else {
            notifications.show(<EventText id="badgePreviewUnavailable" />, {
              severity: "error",
              key: `badge-preview:${eventId}`,
            });
          }
        })
        .catch(() => {
          if (request === sequence.current) {
            setPreviewBusy(false);
            notifications.show(<EventText id="badgePreviewFailed" />, {
              severity: "error",
              key: `badge-preview:${eventId}`,
            });
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      sequence.current += 1;
      notifications.close(`badge-preview:${eventId}`);
    };
  }, [eventId, layout, notifications, previewKind]);

  async function save() {
    if (!layout || busy) {
      return;
    }

    setSaveError(undefined);

    if (
      !badgeLayoutSchema.safeParse(layout).success ||
      !validBadgeBindings(layout, catalog)
    ) {
      setSaveError("badgeCheckBindings");

      return;
    }

    setBusy(true);
    notifications.close(`badge-layout:${eventId}`);

    try {
      const result = await updateBadgeLayout({ eventId, layout });

      if (result.success) {
        setSavedLayout(layout);
        notifications.show(
          <EventText id={result.message as keyof Messages["events"]} />,
          {
            severity: "success",
            autoHideDuration: 4000,
            key: `badge-layout:${eventId}`,
          },
        );
      } else {
        setSaveError(result.message as keyof Messages["events"]);
      }
    } catch {
      setSaveError("badgeSaveFailed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3}>
      <SectionHeader
        description={
          <>
            {layout ? t("badgeLayoutHint") : t("badgeSavedHint")}{" "}
            {t("badgeQrHint")}
          </>
        }
      />
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
                {t("badgeSettings")}
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
              {saveError && <Alert severity="error">{t(saveError)}</Alert>}
              <Button
                variant="contained"
                loading={busy}
                disabled={!dirty}
                onClick={save}
                sx={{ alignSelf: "flex-start" }}
              >
                {t("badgeSaveChanges")}
              </Button>
            </Stack>
          </Paper>
        )}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              {layout ? t("badgeLivePreview") : t("badgeSavedPreview")}
            </Typography>
            {layout && (
              <TextField
                select
                label={t("badgePreviewPerson")}
                value={previewKind}
                onChange={(event) =>
                  setPreviewKind(event.target.value as "PRIMARY" | "GUEST")
                }
              >
                <MenuItem value="PRIMARY">{t("badgeApplicantFields")}</MenuItem>
                <MenuItem value="GUEST">{t("badgeGuestFields")}</MenuItem>
              </TextField>
            )}
            {(preview.editor?.bindingWarnings.length ?? 0) > 0 && (
              <Alert severity="warning">{t("badgeHistoricalHint")}</Alert>
            )}
            {preview.editor?.issues.map((issue) => (
              <Alert key={issue.slot} severity="warning">
                {t("badgeFieldIssue", {
                  slot: issue.slot,
                  reason: issue.reason,
                })}
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
                  lang={preview.language}
                  sx={{
                    width: widthPx,
                    height: heightPx,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    boxShadow: 1,
                  }}
                >
                  <style>{badgeCss}</style>
                  <Badge badge={preview.presentation} labels={preview.labels} />
                </Box>
              </Box>
            </Box>
            <Alert severity="info">
              {previewBusy
                ? t("badgeUpdating")
                : preview.attendeeId
                  ? t("badgeActivePreview")
                  : t("badgeEmptyPreview")}
              {dirty && <> {t("badgeSaveBeforePrint")}</>}
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
                {t("badgeOpenPrint")}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("badgePrintEligibility")}
              </Typography>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
