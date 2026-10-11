"use client";

import CodeOutlined from "@mui/icons-material/CodeOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import {
  Alert,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

export function ExportMenu({
  eventId,
  staff,
  template,
}: {
  eventId: string;
  staff: boolean;
  template: boolean;
}) {
  const t = useTranslations("events");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const datasets = [
    {
      key: "applications",
      label: t("applications"),
      description: t("exportApplicationsHint"),
    },
    {
      key: "attendees",
      label: t("attendees"),
      description: t("exportAttendeesHint"),
    },
    {
      key: "attendance",
      label: t("attendeeAttendance"),
      description: t("exportAttendanceHint"),
    },
    ...(staff
      ? [
          {
            key: "staff",
            label: t("staff"),
            description: t("exportStaffHint"),
          },
        ]
      : []),
  ];

  return (
    <>
      <Button
        startIcon={<DownloadOutlined />}
        aria-controls={anchor ? id : undefined}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {t("export")}
      </Button>
      <Menu
        id={id}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { width: 360, maxWidth: "calc(100vw - 32px)" } },
        }}
      >
        <ListSubheader disableSticky>{t("exportData")}</ListSubheader>
        {datasets.map((dataset) => (
          <MenuItem
            key={dataset.key}
            component="a"
            href={`/api/events/${eventId}/exports/${dataset.key}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchor(null)}
            sx={{ whiteSpace: "normal" }}
          >
            <ListItemIcon>
              <TableChartOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={dataset.label}
              secondary={dataset.description}
            />
          </MenuItem>
        ))}
        <Box component="li" sx={{ px: 2, py: 1, listStyle: "none" }}>
          <Alert severity="info" sx={{ fontSize: "0.75rem" }}>
            {t("exportCsvHint")}
          </Alert>
        </Box>
        {template && <Divider />}
        {template && (
          <ListSubheader disableSticky>
            {t("exportTemplateGroup")}
          </ListSubheader>
        )}
        {template && (
          <MenuItem
            component="a"
            href={`/api/events/${eventId}/exports/template`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchor(null)}
            sx={{ whiteSpace: "normal" }}
          >
            <ListItemIcon>
              <CodeOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t("exportTemplate")}
              secondary={t("exportTemplateHint")}
            />
          </MenuItem>
        )}
        {template && (
          <Box component="li" sx={{ px: 2, py: 1, listStyle: "none" }}>
            <Alert severity="warning" sx={{ fontSize: "0.75rem" }}>
              {t("exportPrivacyHint")}
            </Alert>
          </Box>
        )}
      </Menu>
    </>
  );
}
