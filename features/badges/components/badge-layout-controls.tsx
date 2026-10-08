"use client";

import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import {
  type BadgeField,
  type BadgeLayout,
  badgeSizes,
  sameBadgeField,
} from "@/features/badges/badge-layout";
import { fieldTypeLabels } from "@/features/events/schemas/registration-form";

export function BadgeLayoutControls({
  layout,
  catalog,
  onChange,
}: {
  layout: BadgeLayout;
  catalog: (BadgeField & { context: string })[];
  onChange: (layout: BadgeLayout) => void;
}) {
  function change<K extends keyof BadgeLayout>(key: K, value: BadgeLayout[K]) {
    onChange({ ...layout, [key]: value });
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
        value={index < 0 ? (binding ? "invalid" : "") : String(index)}
        error={Boolean(binding && index < 0)}
        helperText={
          binding && index < 0
            ? "Selected question changed or was removed. Select a compatible question or None."
            : undefined
        }
        onChange={(event) => {
          if (event.target.value === "") {
            change(key, null);

            return;
          }

          const { fieldId, type, label } = catalog[Number(event.target.value)];
          change(key, { fieldId, type, label });
        }}
      >
        {binding && index < 0 && (
          <MenuItem value="invalid" disabled>
            Unavailable binding: {binding.label}
          </MenuItem>
        )}
        <MenuItem value="">None</MenuItem>
        {catalog.map((field, position) => (
          <MenuItem
            key={`${field.fieldId}:${field.type}:${field.label}`}
            value={String(position)}
            sx={{ whiteSpace: "normal" }}
          >
            {field.label} · {fieldTypeLabels[field.type]}
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
    <Stack spacing={2.5}>
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
          onChange={(event) => change("paddingMm", Number(event.target.value))}
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
            change("nameSize", event.target.value as BadgeLayout["nameSize"])
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
            change("alignment", event.target.value as BadgeLayout["alignment"])
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
        Selected values are visible to staff who can print badges, including
        Reception. Guests never inherit these answers.
      </Alert>
    </Stack>
  );
}
