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
import { useId, useState } from "react";

const choices = [
  { value: "system", label: "System", icon: DesktopWindowsOutlined },
  { value: "light", label: "Light", icon: LightModeOutlined },
  { value: "dark", label: "Dark", icon: DarkModeOutlined },
] as const;

export function ThemeControl() {
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const activeChoice =
    choices.find((choice) => choice.value === mode) ?? choices[0];
  const ActiveIcon = activeChoice.icon;
  const label = `Appearance: ${activeChoice.label}`;

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          aria-controls={anchor ? id : undefined}
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <ActiveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id={id}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { "aria-label": "Color mode" } }}
      >
        {choices.map(({ value, label, icon: Icon }) => (
          <MenuItem
            key={value}
            selected={mode === value}
            onClick={() => {
              setMode(value);
              setAnchor(null);
            }}
            sx={{ minWidth: 168 }}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
            {mode === value && <Check fontSize="small" sx={{ ml: 2 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
