"use client";

import Translate from "@mui/icons-material/Translate";
import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { localeNames, selectableLocales } from "@/lib/i18n/locale";
import { useLocalePreference } from "@/providers/locale-provider";

function LocaleSaveError() {
  const t = useTranslations("locale");

  return t("saveFailed");
}

export function LanguageSelector() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const { pending, changeLocale } = useLocalePreference();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const notifications = useNotifications();
  const busy = useRef(false);
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
        {selectableLocales.map((value) => (
          <MenuItem
            key={value}
            lang={value}
            selected={locale === value}
            disabled={pending}
            onClick={async () => {
              if (busy.current) {
                return;
              }
              busy.current = true;
              notifications.close("locale-save");

              try {
                const result = await changeLocale(value);

                if (result === "saved") {
                  setAnchor(null);
                } else {
                  notifications.show(<LocaleSaveError />, {
                    severity: "error",
                    key: "locale-save",
                  });
                }
              } finally {
                busy.current = false;
              }
            }}
          >
            {localeNames[value]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
