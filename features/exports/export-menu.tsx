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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const datasets = [
    {
      key: "applications",
      label: "Applications",
      description: "All submission attempts and answers",
    },
    {
      key: "attendees",
      label: "Attendees",
      description: "Primary attendees and guests, including revoked",
    },
    {
      key: "attendance",
      label: "Attendance",
      description: "All recorded arrivals",
    },
    ...(staff
      ? [
          {
            key: "staff",
            label: "Staff",
            description: "Owner, managers and reception",
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
        Export
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
        <ListSubheader disableSticky>Event data · CSV</ListSubheader>
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
            Exports include the whole event, regardless of filters.
            Spreadsheet-safe files may prefix values with an apostrophe.
          </Alert>
        </Box>
        {template && <Divider />}
        {template && (
          <ListSubheader disableSticky>Event template · JSON</ListSubheader>
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
              primary="Export template"
              secondary="Reuse current settings, form and badge design"
            />
          </MenuItem>
        )}
        {template && (
          <Box component="li" sx={{ px: 2, py: 1, listStyle: "none" }}>
            <Alert severity="warning" sx={{ fontSize: "0.75rem" }}>
              Includes private staff emails and unpublished changes. No
              applications, attendees or attendance.
            </Alert>
          </Box>
        )}
      </Menu>
    </>
  );
}
