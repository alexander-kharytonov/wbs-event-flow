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
import { useTranslations } from "next-intl";
import {
  type BadgeField,
  type BadgeFieldContext,
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
  catalog: (BadgeField & BadgeFieldContext)[];
  onChange: (layout: BadgeLayout) => void;
}) {
  const t = useTranslations("events");
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
        helperText={binding && index < 0 ? t("badgeBindingHint") : undefined}
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
            {t("badgeBindingUnavailable", { label: binding.label })}
          </MenuItem>
        )}
        <MenuItem value="">{t("badgeNone")}</MenuItem>
        {catalog.map((field, position) => (
          <MenuItem
            key={`${field.fieldId}:${field.type}:${field.label}`}
            value={String(position)}
            sx={{ whiteSpace: "normal" }}
          >
            {field.subject &&
              `${t(field.subject === "GUEST" ? "badgeGuestFields" : "badgeApplicantFields")} · `}
            {field.label} · {t(fieldTypeLabels[field.type])}
            {catalog.some(
              (other) =>
                other.fieldId !== field.fieldId &&
                other.label === field.label &&
                other.type === field.type,
            ) && ` · ${t(field.context, field.contextValues)}`}
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
          label={t("badgeSize")}
          value={layout.size}
          onChange={(event) =>
            change("size", event.target.value as BadgeLayout["size"])
          }
        >
          {Object.entries(badgeSizes).map(([value, size]) => (
            <MenuItem key={value} value={value}>
              {t("badgeDimensions", { width: size.width, height: size.height })}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          select
          label={t("badgePadding")}
          value={layout.paddingMm}
          onChange={(event) => change("paddingMm", Number(event.target.value))}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <MenuItem key={value} value={value}>
              {t("badgeMm", { value })}
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
          label={t("badgeOrientation")}
          sx={{ gridColumn: { md: "1 / -1", lg: "auto" } }}
          value={layout.orientation}
          onChange={(event) =>
            change(
              "orientation",
              event.target.value as BadgeLayout["orientation"],
            )
          }
        >
          <MenuItem value="LANDSCAPE">{t("badgeLandscape")}</MenuItem>
          <MenuItem value="PORTRAIT">{t("badgePortrait")}</MenuItem>
        </TextField>
        <TextField
          fullWidth
          select
          label={t("badgeNameSize")}
          value={layout.nameSize}
          onChange={(event) =>
            change("nameSize", event.target.value as BadgeLayout["nameSize"])
          }
        >
          <MenuItem value="SMALL">{t("badgeSmall")}</MenuItem>
          <MenuItem value="MEDIUM">{t("badgeMedium")}</MenuItem>
          <MenuItem value="LARGE">{t("badgeLarge")}</MenuItem>
        </TextField>
        <TextField
          fullWidth
          select
          label={t("badgeAlignment")}
          value={layout.alignment}
          onChange={(event) =>
            change("alignment", event.target.value as BadgeLayout["alignment"])
          }
        >
          <MenuItem value="LEFT">{t("badgeLeft")}</MenuItem>
          <MenuItem value="CENTER">{t("badgeCenter")}</MenuItem>
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
            ["showEventName", t("eventName")],
            ["showAttendeeType", t("badgeAttendeeType")],
            ["showQr", "QR"],
            ["showTicketNumber", t("ticketNumber")],
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
      {fieldSelect("secondaryField", t("badgeSecondary"))}
      {fieldSelect("tertiaryField", t("badgeTertiary"))}
      <Alert severity="info">{t("badgePrivacyHint")}</Alert>
    </Stack>
  );
}
