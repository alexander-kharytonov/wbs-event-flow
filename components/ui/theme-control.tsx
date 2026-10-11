"use client";

import Check from "@mui/icons-material/Check";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import {
  Alert,
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useModePreference } from "@/providers/mode-preference-provider";

const choices = [
  { value: "system", label: "System", icon: DesktopWindowsOutlined },
  { value: "light", label: "Light", icon: LightModeOutlined },
  { value: "dark", label: "Dark", icon: DarkModeOutlined },
] as const;

export function ThemeControl() {
  const t = useTranslations("shell");
  const { mode, pending, changeMode } = useModePreference();
  const [error, setError] = useState<"modeSaveFailed" | "modeSyncFailed">();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const activeChoice =
    choices.find((choice) => choice.value === mode) ?? choices[0];
  const ActiveIcon = activeChoice.icon;
  const label = t("appearance", { mode: t(activeChoice.value) });

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          aria-controls={anchor ? id : undefined}
          aria-expanded={Boolean(anchor)}
          disabled={pending}
          onClick={(event) => {
            setError(undefined);
            setAnchor(event.currentTarget);
          }}
        >
          <ActiveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id={id}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { "aria-label": t("colorMode") } }}
      >
        {choices.map(({ value, icon: Icon }) => (
          <MenuItem
            key={value}
            selected={mode === value}
            disabled={pending}
            onClick={async () => {
              setError(undefined);
              const result = await changeMode(value);

              if (result === "saved") {
                setAnchor(null);
              } else {
                setError(
                  result === "syncFailed" ? "modeSyncFailed" : "modeSaveFailed",
                );
              }
            }}
            sx={{ minWidth: 168 }}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t(value)}</ListItemText>
            {mode === value && <Check fontSize="small" sx={{ ml: 2 }} />}
          </MenuItem>
        ))}
        {error && (
          <Box sx={{ px: 2, py: 1, maxWidth: 300 }}>
            <Alert severity="error">{t(error)}</Alert>
          </Box>
        )}
      </Menu>
    </>
  );
}
