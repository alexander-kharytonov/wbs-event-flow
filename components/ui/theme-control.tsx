"use client";

import Check from "@mui/icons-material/Check";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { ShellText } from "@/components/ui/shell-text";
import { useNotifications } from "@/hooks/use-notifications";
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
  const mounted = useRef(false);
  const notifications = useNotifications();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const activeChoice =
    choices.find((choice) => choice.value === (mode ?? initialMode)) ??
    choices[0];
  const ActiveIcon = activeChoice.icon;
  const label = t("appearance", { mode: t(activeChoice.value) });

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

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
              notifications.close("mode-save");

              try {
                const response = await fetch("/api/preferences/mode", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(value),
                });

                if (!mounted.current) {
                  return;
                }

                if (!response.ok) {
                  throw new Error("modeSaveFailed");
                }
                setMode(value);
                setAnchor(null);
              } catch {
                if (mounted.current) {
                  notifications.show(<ShellText id="modeSaveFailed" />, {
                    severity: "error",
                    key: "mode-save",
                  });
                }
              } finally {
                busy.current = false;

                if (mounted.current) {
                  setPending(false);
                }
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
      </Menu>
    </>
  );
}
