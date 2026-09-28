"use client";

import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#243caa", contrastText: "#ffffff" },
        secondary: { main: "#7026a3", contrastText: "#ffffff" },
        info: { main: "#007f9c", contrastText: "#ffffff" },
        background: { default: "#f5f7fc", paper: "#ffffff" },
        text: { primary: "#172044", secondary: "#596580" },
        divider: "#dce1ee",
      },
    },
    dark: {
      palette: {
        primary: { main: "#a9baff", contrastText: "#111c4a" },
        secondary: { main: "#d5a8f4", contrastText: "#301245" },
        info: { main: "#6bd9ef", contrastText: "#082c36" },
        background: { default: "#101426", paper: "#191f36" },
        text: { primary: "#eef1ff", secondary: "#b2bdd6" },
        divider: "#353f5b",
      },
    },
  },
  cssVariables: { colorSchemeSelector: "data" },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    h3: { fontWeight: 650, letterSpacing: "-0.04em" },
    h4: { fontWeight: 650, letterSpacing: "-0.035em", fontSize: "2rem" },
    h5: { fontWeight: 600, letterSpacing: "-0.025em" },
    h6: { fontWeight: 600, letterSpacing: "-0.015em" },
    body1: { lineHeight: 1.65 },
    body2: { lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    overline: { fontWeight: 700, letterSpacing: "0.12em" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 42, paddingInline: 18 },
        sizeSmall: { minHeight: 36 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiMenu: {
      styleOverrides: {
        paper: { marginTop: 8, minWidth: 200 },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 44 } } },
    MuiCssBaseline: {
      styleOverrides: {
        "*:focus-visible": {
          outline: "3px solid var(--mui-palette-primary-main)",
          outlineOffset: 3,
        },
        "::selection": {
          background: "var(--mui-palette-primary-main)",
          color: "var(--mui-palette-primary-contrastText)",
        },
        html: { scrollPaddingTop: 24 },
      },
    },
  },
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
