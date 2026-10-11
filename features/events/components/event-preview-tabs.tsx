"use client";

import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import { Alert, Box, Stack, Tab } from "@mui/material";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";

export function EventPreviewTabs({
  landing,
  registration,
}: {
  landing: ReactNode;
  registration: ReactNode;
}) {
  const t = useTranslations("events");
  const [section, setSection] = useState("landing");

  return (
    <Stack sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          borderBottom: 1,
          borderColor: "divider",
          minWidth: 0,
        }}
      >
        <WorkspaceTabs
          layout="horizontal"
          value={section}
          onChange={(_, value) => setSection(value)}
          aria-label={t("previewSections")}
        >
          <Tab
            value="landing"
            label={t("landing")}
            icon={<ArticleOutlined fontSize="small" />}
            iconPosition="start"
            id="preview-landing-tab"
            aria-controls="preview-landing-panel"
            sx={{ pr: 3 }}
          />
          <Tab
            value="registration"
            label={t("registration")}
            icon={<AssignmentOutlined fontSize="small" />}
            iconPosition="start"
            id="preview-registration-tab"
            aria-controls="preview-registration-panel"
            sx={{ pr: 3 }}
          />
        </WorkspaceTabs>
      </Box>
      <Stack spacing={3} sx={{ p: { xs: 2, sm: 4 }, minWidth: 0 }}>
        <Alert severity="info">{t("previewNotice")}</Alert>
        <Box
          role="tabpanel"
          hidden={section !== "landing"}
          id="preview-landing-panel"
          aria-labelledby="preview-landing-tab"
        >
          {landing}
        </Box>
        <Box
          role="tabpanel"
          hidden={section !== "registration"}
          id="preview-registration-panel"
          aria-labelledby="preview-registration-tab"
        >
          {registration}
        </Box>
      </Stack>
    </Stack>
  );
}
