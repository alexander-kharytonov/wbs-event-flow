"use client";

import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";

export function ThemeControl() {
  const { mode, setMode } = useColorScheme();

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode ?? null}
      aria-label="Color mode"
      onChange={(_, value: "system" | "light" | "dark" | null) => {
        if (value) {
          setMode(value);
        }
      }}
    >
      <ToggleButton value="system" aria-label="System color mode">
        <SettingsBrightnessOutlined fontSize="small" sx={{ mr: 0.5 }} />
        System
      </ToggleButton>
      <ToggleButton value="light" aria-label="Light color mode">
        <LightModeOutlined fontSize="small" sx={{ mr: 0.5 }} />
        Light
      </ToggleButton>
      <ToggleButton value="dark" aria-label="Dark color mode">
        <DarkModeOutlined fontSize="small" sx={{ mr: 0.5 }} />
        Dark
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
