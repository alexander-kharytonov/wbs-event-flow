"use client";

import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import { Box, Stack, Tab } from "@mui/material";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import {
  ComposeMessage,
  RefreshCommunicationHistory,
} from "@/features/communications/components/compose-message";
import type { Messages } from "@/lib/i18n/messages";

export function CommunicationsWorkspace({
  eventId,
  disabledReason,
  initialHistory,
  history,
}: {
  eventId: string;
  disabledReason?: keyof Messages["events"];
  initialHistory: boolean;
  history: ReactNode;
}) {
  const t = useTranslations("events");
  const [section, setSection] = useState(
    initialHistory ? "history" : "compose",
  );
  const historyTab = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncSection = () => {
      setSection(
        window.location.hash === "#communication-history" || initialHistory
          ? "history"
          : "compose",
      );
    };
    syncSection();
    window.addEventListener("hashchange", syncSection);
    window.addEventListener("popstate", syncSection);

    return () => {
      window.removeEventListener("hashchange", syncSection);
      window.removeEventListener("popstate", syncSection);
    };
  }, [initialHistory]);

  function selectSection(next: string) {
    setSection(next);
    const hash = next === "history" ? "#communication-history" : "";
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  }

  return (
    <Stack sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          minWidth: 0,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <WorkspaceTabs
          layout="horizontal"
          value={section}
          onChange={(_, value) => selectSection(value)}
          aria-label={t("communications")}
        >
          <Tab
            value="compose"
            label={t("commNew")}
            icon={<SendOutlined fontSize="small" />}
            iconPosition="start"
            id="communication-compose-tab"
            aria-controls="communication-compose-panel"
            sx={{ pr: 3 }}
          />
          <Tab
            ref={historyTab}
            value="history"
            label={t("commHistory")}
            icon={<HistoryOutlined fontSize="small" />}
            iconPosition="start"
            id="communication-history-tab"
            aria-controls="communication-history"
            sx={{ pr: 3 }}
          />
        </WorkspaceTabs>
      </Box>
      <Box sx={{ p: { xs: 2, sm: 4 }, minWidth: 0 }}>
        <Stack
          role="tabpanel"
          id="communication-compose-panel"
          aria-labelledby="communication-compose-tab"
          hidden={section !== "compose"}
          sx={{ display: section === "compose" ? "flex" : "none" }}
          spacing={3}
        >
          <SectionHeader description={t("communicationsDescription")} />
          <ComposeMessage
            eventId={eventId}
            disabledReason={disabledReason}
            onViewHistory={() => {
              selectSection("history");
              historyTab.current?.focus();
            }}
          />
        </Stack>
        <Stack
          role="tabpanel"
          id="communication-history"
          aria-labelledby="communication-history-tab"
          hidden={section !== "history"}
          sx={{
            display: section === "history" ? "flex" : "none",
            scrollMarginTop: 24,
          }}
          spacing={3}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{
              gap: 2,
              alignItems: { sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <SectionHeader description={t("commSentExplanation")} />
            <RefreshCommunicationHistory />
          </Stack>
          {history}
        </Stack>
      </Box>
    </Stack>
  );
}
