"use client";

import { Tabs, type TabsProps, useMediaQuery, useTheme } from "@mui/material";

export function WorkspaceTabs({
  children,
  layout = "responsive",
  ...props
}: Pick<
  TabsProps,
  "children" | "value" | "onChange" | "selectionFollowsFocus" | "aria-label"
> & { layout?: "responsive" | "horizontal" }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const vertical = layout === "responsive" && desktop;
  const direction = {
    xs: "row",
    md: layout === "horizontal" ? "row" : "column",
  };

  return (
    <Tabs
      {...props}
      orientation={vertical ? "vertical" : "horizontal"}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      visibleScrollbar={false}
      sx={{
        minWidth: 0,
        minHeight: 0,
        flex: 1,
        flexDirection: direction,
        "& .MuiTabs-scrollButtons.Mui-disabled": { opacity: 0.3 },
        "& .MuiTab-root": {
          minHeight: 56,
          pl: 3,
          py: 2,
          justifyContent: "flex-start",
          textTransform: "none",
        },
        "& .MuiTab-root.Mui-selected": {
          boxShadow: {
            xs: "inset 0 -2px 0 currentColor",
            md:
              layout === "horizontal"
                ? "inset 0 -2px 0 currentColor"
                : "inset -2px 0 0 currentColor",
          },
        },
      }}
      // CSS controls the first paint; orientation supplies MUI keyboard behavior.
      slotProps={{
        list: { sx: { flexDirection: direction } },
        scroller: {
          sx: {
            overflowX: {
              xs: "auto",
              md: layout === "horizontal" ? "auto" : "hidden",
            },
            overflowY: {
              xs: "hidden",
              md: layout === "horizontal" ? "hidden" : "auto",
            },
          },
        },
        indicator: { sx: { display: "none" } },
      }}
    >
      {children}
    </Tabs>
  );
}
