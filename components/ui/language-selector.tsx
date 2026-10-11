"use client";

import Translate from "@mui/icons-material/Translate";
import { Alert, Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { localeNames, locales } from "@/lib/i18n/locale";
import { useLocalePreference } from "@/providers/locale-provider";

export function LanguageSelector() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const { pending, changeLocale } = useLocalePreference();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Store stable identifiers, translate at render so errors follow locale changes.
  const [error, setError] = useState<"saveFailed">();
  const id = useId();

  return (
    <Box>
      <Tooltip title={t("label")}>
        <IconButton
          aria-label={t("label")}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? id : undefined}
          disabled={pending}
          onClick={(event) => {
            setError(undefined);
            setAnchor(event.currentTarget);
          }}
        >
          <Translate fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id={id}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { "aria-label": t("label") } }}
      >
        {locales.map((value) => (
          <MenuItem
            key={value}
            lang={value}
            selected={locale === value}
            disabled={pending}
            onClick={async () => {
              setError(undefined);
              const result = await changeLocale(value);

              if (result === "saved") {
                setAnchor(null);
              } else {
                setError(result);
              }
            }}
          >
            {localeNames[value]}
          </MenuItem>
        ))}
        {error && (
          <Box sx={{ px: 2, py: 1, maxWidth: 300 }}>
            <Alert severity="error">{t(error)}</Alert>
          </Box>
        )}
      </Menu>
    </Box>
  );
}
