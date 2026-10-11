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
import { useColorScheme } from "@mui/material/styles";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import type { UiMode } from "@/lib/ui-mode";

const choices = [
  { value: "system", label: "System", icon: DesktopWindowsOutlined },
  { value: "light", label: "Light", icon: LightModeOutlined },
  { value: "dark", label: "Dark", icon: DarkModeOutlined },
] as const;

export function ThemeControl({ initialMode }: { initialMode: UiMode }) {
  const t = useTranslations("shell");
  const { mode, setMode } = useColorScheme();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<"modeSaveFailed">();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const activeChoice =
    choices.find((choice) => choice.value === (mode ?? initialMode)) ??
    choices[0];
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
            selected={(mode ?? initialMode) === value}
            disabled={pending}
            onClick={async () => {
              if (busy.current) {
                return;
              }
              busy.current = true;
              setPending(true);
              setError(undefined);

              try {
                const response = await fetch("/api/preferences/mode", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(value),
                });

                if (!response.ok) {
                  setError("modeSaveFailed");

                  return;
                }
                setMode(value);
                setAnchor(null);
              } catch {
                setError("modeSaveFailed");
              } finally {
                busy.current = false;
                setPending(false);
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
