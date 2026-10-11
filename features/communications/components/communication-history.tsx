"use client";

import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { filterCommunicationHistory } from "@/features/communications/actions";
import { audienceLabel } from "@/features/communications/audiences";
import { CommunicationKind } from "@/features/communications/components/communication-kind";
import { DeliverySummary } from "@/features/communications/components/delivery-summary";
import { EventAccessStatus } from "@/features/events/components/event-access-status";

type HistoryPage = NonNullable<
  Awaited<ReturnType<typeof filterCommunicationHistory>>
>;
type KindFilter = "ALL" | "MANUAL" | "TRANSACTIONAL";

export function CommunicationHistory({
  eventId,
  timezone,
  initialData,
  initialBefore,
}: {
  eventId: string;
  timezone: string;
  initialData: HistoryPage;
  initialBefore?: string;
}) {
  const t = useTranslations("events");
  const locale = useLocale();
  const [filters, setFilters] = useState<{
    subject: string;
    kind: KindFilter;
    before?: string;
  }>({ subject: "", kind: "MANUAL", before: initialBefore });
  const [result, setResult] = useState<{
    key: string;
    source: HistoryPage;
    data: HistoryPage | null;
    error?: "commHistoryUnavailable" | "commHistoryFailed";
  }>();
  const [retry, setRetry] = useState(0);
  const subject = filters.subject.trim();
  const key = JSON.stringify([
    eventId,
    subject,
    filters.kind,
    filters.before,
    retry,
  ]);
  const useInitial =
    !subject && filters.kind === "MANUAL" && filters.before === initialBefore;
  const current =
    result?.key === key && result.source === initialData ? result : undefined;
  const data = useInitial ? initialData : current?.data;
  const loading = !useInitial && !current;
  const base = `/dashboard/events/${eventId}/communications`;
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  useEffect(() => {
    if (useInitial) {
      return;
    }

    let disposed = false;
    const timer = setTimeout(async () => {
      try {
        const page = await filterCommunicationHistory({
          eventId,
          subject,
          kind: filters.kind,
          before: filters.before,
        });

        if (!disposed) {
          setResult({
            key,
            source: initialData,
            data: page,
            error: page ? undefined : "commHistoryUnavailable",
          });
        }
      } catch {
        if (!disposed) {
          setResult({
            key,
            source: initialData,
            data: null,
            error: "commHistoryFailed",
          });
        }
      }
    }, 250);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [
    eventId,
    subject,
    filters.kind,
    filters.before,
    key,
    initialData,
    useInitial,
  ]);

  const clearFilters = () => setFilters({ subject: "", kind: "ALL" });

  return (
    <Stack spacing={2}>
      <Stack
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        <TextField
          label={t("commSearch")}
          placeholder={t("commSubject")}
          value={filters.subject}
          onChange={(event) =>
            setFilters({
              ...filters,
              subject: event.target.value,
              before: undefined,
            })
          }
          slotProps={{
            htmlInput: { maxLength: 400 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 0 }}
        />
        <TextField
          select
          label={t("commType")}
          value={filters.kind}
          onChange={(event) => {
            const kind = event.target.value;

            if (
              kind === "ALL" ||
              kind === "MANUAL" ||
              kind === "TRANSACTIONAL"
            ) {
              setFilters({ ...filters, kind, before: undefined });
            }
          }}
          sx={{ minWidth: 0 }}
        >
          {(["ALL", "MANUAL", "TRANSACTIONAL"] as const).map((kind) => (
            <MenuItem key={kind} value={kind}>
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  color:
                    kind === "MANUAL"
                      ? "primary.main"
                      : kind === "TRANSACTIONAL"
                        ? "info.main"
                        : "text.primary",
                }}
              >
                {kind === "MANUAL" ? (
                  <EditNoteOutlined fontSize="small" />
                ) : kind === "TRANSACTIONAL" ? (
                  <SettingsOutlined fontSize="small" />
                ) : (
                  <EmailOutlined fontSize="small" />
                )}
                {kind === "ALL"
                  ? t("uiAll")
                  : kind === "MANUAL"
                    ? t("uiManual")
                    : t("uiTransactional")}
              </Box>
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Box aria-busy={loading}>
        {loading ? (
          <Paper
            variant="outlined"
            role="status"
            aria-label={t("commLoading")}
            sx={{ overflow: "hidden" }}
          >
            {["first", "second", "third"].map((row, index) => (
              <Stack
                key={row}
                spacing={1.75}
                aria-hidden="true"
                sx={{
                  px: { xs: 2, sm: 3 },
                  py: 2.5,
                  borderTop: index > 0 ? 1 : 0,
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  sx={{ gap: 1, justifyContent: "space-between" }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flex: 1 }}
                  >
                    <Skeleton width="45%" height={28} />
                    <Skeleton variant="rounded" width={90} height={24} />
                  </Stack>
                  <Skeleton width={200} height={20} />
                </Stack>
                <Skeleton width="35%" height={22} />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Skeleton width="25%" height={22} />
                  <Skeleton variant="rounded" width={75} height={24} />
                </Stack>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    pt: 1.5,
                    borderTop: 1,
                    borderColor: "divider",
                    alignItems: "center",
                  }}
                >
                  <Skeleton variant="rounded" width={65} height={24} />
                  <Skeleton width="50%" height={20} />
                </Stack>
              </Stack>
            ))}
          </Paper>
        ) : current?.error && !useInitial ? (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                onClick={() => setRetry((value) => value + 1)}
              >
                {t("commRetryLoad")}
              </Button>
            }
          >
            {t(current.error)}
          </Alert>
        ) : (
          data &&
          (data.items.length === 0 ? (
            <EmptyState
              icon={<EmailOutlined />}
              title={
                subject || filters.kind !== "ALL"
                  ? t("commNoMatch")
                  : data.hasCursor
                    ? t("commNoMore")
                    : t("commNone")
              }
              description={
                subject || filters.kind !== "ALL"
                  ? t("commFiltersHint")
                  : data.hasCursor
                    ? t("commHistoryEnd")
                    : t("commHistoryEmptyHint")
              }
              action={
                subject || filters.kind !== "ALL" ? (
                  <Button onClick={clearFilters}>{t("clearFilters")}</Button>
                ) : undefined
              }
            />
          ) : (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <List disablePadding aria-label={t("commHistory")}>
                {data.items.map((item, index) => (
                  <ListItem
                    key={item.id}
                    disablePadding
                    divider={index < data.items.length - 1}
                  >
                    <ListItemButton
                      component={NextLink}
                      href={`${base}/${item.id}`}
                      scroll={false}
                      aria-label={t("commView", { subject: item.subject })}
                      sx={{
                        px: { xs: 2, sm: 3 },
                        py: 2.5,
                        gap: 2,
                        alignItems: "flex-start",
                      }}
                    >
                      <Stack spacing={1.75} sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: { xs: "column", md: "row" },
                            gap: 1,
                            justifyContent: "space-between",
                            alignItems: { md: "flex-start" },
                          }}
                        >
                          <Stack
                            direction="row"
                            useFlexGap
                            sx={{
                              gap: 1,
                              alignItems: "center",
                              flexWrap: "wrap",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              component="h3"
                              sx={{
                                fontWeight: 600,
                                overflowWrap: "anywhere",
                                minWidth: 0,
                              }}
                            >
                              {item.subject}
                            </Typography>
                            <CommunicationKind kind={item.kind} />
                          </Stack>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="time"
                            dateTime={item.createdAt.toISOString()}
                            sx={{ flexShrink: 0, pt: { md: 0.5 } }}
                          >
                            {dateFormat.format(item.createdAt)} · {timezone}
                          </Typography>
                        </Box>
                        <Stack spacing={1}>
                          <Typography variant="body2" color="text.secondary">
                            {item.audience
                              ? t(
                                  audienceLabel(item.audience) ??
                                    "commAudience",
                                )
                              : t("commTrigger", {
                                  trigger: item.trigger ?? "",
                                })}
                            {" · "}
                            {t("commRecipients", {
                              count: item.recipientCount,
                            })}
                          </Typography>
                          {item.actorNameSnapshot && (
                            <Stack
                              direction="row"
                              useFlexGap
                              sx={{
                                gap: 1,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ overflowWrap: "anywhere", minWidth: 0 }}
                              >
                                {item.actorNameSnapshot}
                              </Typography>
                              {item.actorRoleSnapshot && (
                                <EventAccessStatus
                                  role={item.actorRoleSnapshot}
                                />
                              )}
                            </Stack>
                          )}
                        </Stack>
                        <Box
                          sx={{ pt: 1.5, borderTop: 1, borderColor: "divider" }}
                        >
                          <DeliverySummary
                            recipientCount={item.recipientCount}
                            counts={item.deliveryCounts}
                            compact
                          />
                        </Box>
                      </Stack>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          ))
        )}
      </Box>
      {data && (
        <Stack direction="row" spacing={1}>
          {data.hasCursor && (
            <Button
              onClick={() => setFilters({ ...filters, before: undefined })}
            >
              {t("commLatest")}
            </Button>
          )}
          {data.nextCursor && (
            <Button
              onClick={() =>
                setFilters({ ...filters, before: data.nextCursor })
              }
            >
              {t("commOlder")}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
