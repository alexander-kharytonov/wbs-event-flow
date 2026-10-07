"use client";

import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import { Button, Menu, MenuItem, Typography } from "@mui/material";
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
    "applications",
    "attendees",
    "attendance",
    ...(staff ? ["staff"] : []),
  ];

  return (
    <>
      <Button
        size="small"
        startIcon={<DownloadOutlined />}
        aria-controls={anchor ? id : undefined}
        aria-haspopup="true"
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
      >
        {datasets.map((dataset) => (
          <MenuItem
            key={dataset}
            component="a"
            href={`/api/events/${eventId}/exports/${dataset}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchor(null)}
          >
            {dataset[0].toUpperCase() + dataset.slice(1)} CSV
          </MenuItem>
        ))}
        <Typography
          component="li"
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, py: 1, maxWidth: 280, listStyle: "none" }}
        >
          Whole event, regardless of filters. Spreadsheet-safe files may prefix
          values with an apostrophe.
        </Typography>
        {template && (
          <MenuItem
            component="a"
            href={`/api/events/${eventId}/exports/template`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchor(null)}
          >
            Export template
          </MenuItem>
        )}
        {template && (
          <Typography
            component="li"
            variant="caption"
            color="text.secondary"
            sx={{ px: 2, py: 1, maxWidth: 280, listStyle: "none" }}
          >
            Current configuration, including unpublished changes and staff
            emails. No applications, attendees or attendance.
          </Typography>
        )}
      </Menu>
    </>
  );
}
