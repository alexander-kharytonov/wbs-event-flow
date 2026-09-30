"use client";

import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import NextLink from "next/link";

const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#b84900",
          light: "#ffd85a",
          dark: "#963900",
          contrastText: "#fefefe",
        },
        secondary: {
          main: "#a7472f",
          light: "#ef9b83",
          dark: "#803321",
          contrastText: "#fefefe",
        },
        info: {
          main: "#176d80",
          light: "#79bfcc",
          dark: "#105364",
          contrastText: "#fefefe",
        },
        success: {
          main: "#26734d",
          light: "#85c6a0",
          dark: "#195337",
          contrastText: "#fefefe",
        },
        warning: {
          main: "#865b08",
          light: "#e8bf63",
          dark: "#664300",
          contrastText: "#fefefe",
        },
        error: {
          main: "#b52246",
          light: "#ef8fa7",
          dark: "#8e1735",
          contrastText: "#fefefe",
        },
        background: { default: "#faf9f7", paper: "#fefefe" },
        text: { primary: "#29251f", secondary: "#6a6258", disabled: "#81796f" },
        divider: "#e5e1da",
        action: {
          active: "#6a6258",
          hover: "rgba(184, 73, 0, 0.05)",
          selected: "rgba(255, 207, 64, 0.18)",
          focus: "rgba(184, 73, 0, 0.16)",
          disabled: "#81796f",
          disabledBackground: "#eeebe5",
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#b58aff",
          light: "#d2b7ff",
          dark: "#9e6be8",
          contrastText: "#190d2c",
        },
        secondary: {
          main: "#c4ef73",
          light: "#def5af",
          dark: "#9fc94f",
          contrastText: "#19220c",
        },
        info: {
          main: "#74c9df",
          light: "#ade3ef",
          dark: "#4dabc3",
          contrastText: "#0b232b",
        },
        success: {
          main: "#81d9a4",
          light: "#b0e9c6",
          dark: "#54b77c",
          contrastText: "#10281b",
        },
        warning: {
          main: "#e7bc67",
          light: "#f3d9a2",
          dark: "#c69a47",
          contrastText: "#2c210c",
        },
        error: {
          main: "#ff9caa",
          light: "#ffc2cb",
          dark: "#e0788c",
          contrastText: "#350f1a",
        },
        background: { default: "#0d101c", paper: "#191b2e" },
        text: { primary: "#f0eef8", secondary: "#b5b2ca", disabled: "#88859d" },
        divider: "#35354c",
        action: {
          active: "#b5b2ca",
          hover: "rgba(181, 138, 255, 0.07)",
          selected: "rgba(181, 138, 255, 0.14)",
          focus: "rgba(196, 239, 115, 0.16)",
          disabled: "#88859d",
          disabledBackground: "#292b3e",
        },
      },
    },
  },
  shape: { borderRadius: 10 },
  cssVariables: { colorSchemeSelector: "data" },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    h3: { fontWeight: 650, letterSpacing: "-0.04em" },
    h4: {
      fontWeight: 650,
      letterSpacing: "-0.035em",
      fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
    },
    h5: { fontWeight: 600, letterSpacing: "-0.025em" },
    h6: { fontWeight: 600, letterSpacing: "-0.015em" },
    subtitle1: { fontWeight: 600 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    overline: { fontWeight: 700, letterSpacing: "0.12em" },
  },
  components: {
    MuiLink: {
      defaultProps: { component: NextLink },
    },
    MuiButtonBase: {
      defaultProps: { LinkComponent: NextLink },
    },
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
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6, maxWidth: "100%" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          margin: 16,
          width: "calc(100% - 32px)",
          maxHeight: "calc(100% - 32px)",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: "16px 24px", flexWrap: "wrap", gap: 8 },
      },
    },
    MuiAlert: {
      styleOverrides: { message: { minWidth: 0, overflowWrap: "anywhere" } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--mui-palette-background-paper)",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-text-disabled)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-text-secondary)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-primary-main)",
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-error-main)",
          },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-divider)",
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          marginTop: 8,
          minWidth: 200,
          backgroundColor: "var(--mui-palette-background-paper)",
          border: "1px solid var(--mui-palette-divider)",
          boxShadow: "0 12px 36px rgb(0 0 0 / 16%)",
        },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 44 } } },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: "var(--mui-palette-action-selected)" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: "var(--mui-palette-action-selected)" },
        bar: ({ theme, ownerState }) => ({
          ...theme.applyStyles("dark", {
            ...(ownerState.color === "primary" && {
              backgroundColor: "var(--mui-palette-secondary-main)",
            }),
          }),
        }),
      },
    },
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        "*:focus-visible": {
          outline: "3px solid var(--mui-palette-primary-main)",
          outlineOffset: 3,
        },
        "::selection": {
          background: "var(--mui-palette-primary-light)",
          color: "var(--mui-palette-text-primary)",
        },
        html: { scrollPaddingTop: 24 },
        ...theme.applyStyles("dark", {
          "::selection": {
            background: "var(--mui-palette-primary-main)",
            color: "var(--mui-palette-primary-contrastText)",
          },
          "*:focus-visible": {
            outlineColor: "var(--mui-palette-secondary-main)",
          },
          ".MuiButtonBase-root.Mui-focusVisible": {
            outline: "3px solid var(--mui-palette-secondary-main)",
            outlineOffset: 3,
          },
        }),
      }),
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
