"use client";

import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import Close from "@mui/icons-material/Close";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import ExploreOutlined from "@mui/icons-material/ExploreOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/ui/logo";

export function PrimaryNavigation({
  signedIn,
  organizer,
}: {
  signedIn: boolean;
  organizer: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("lg"));
  const links = [
    { href: "/e", label: "Explore events", icon: ExploreOutlined },
    ...(signedIn
      ? [{ href: "/account", label: "My account", icon: AccountCircleOutlined }]
      : []),
    ...(organizer
      ? [{ href: "/dashboard", label: "Organizer", icon: DashboardOutlined }]
      : []),
  ];
  const mobileLinks = [
    links[0],
    ...(signedIn
      ? [
          {
            href: "/account",
            label: "Account overview",
            icon: AccountCircleOutlined,
          },
          {
            href: "/account/registrations",
            label: "My registrations",
            icon: EventAvailableOutlined,
          },
          { href: "/account/profile", label: "Profile", icon: PersonOutlined },
          {
            href: organizer ? "/dashboard" : "/onboarding/organizer",
            label: organizer ? "Organizer workspace" : "Become an organizer",
            icon: DashboardOutlined,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (!mobile) {
      setOpen(false);
    }
  }, [mobile]);

  return (
    <>
      <IconButton
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(true)}
        sx={{ display: { xs: "inline-flex", lg: "none" } }}
      >
        <MenuOutlined />
      </IconButton>
      <Stack
        component="nav"
        aria-label="Main navigation"
        direction="row"
        sx={{ display: { xs: "none", lg: "flex" }, gap: 0.5, minWidth: 0 }}
      >
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Button
              key={href}
              href={href}
              color={active ? "primary" : "inherit"}
              aria-current={active ? "page" : undefined}
              sx={{
                whiteSpace: "nowrap",
                flexShrink: 0,
                bgcolor: active ? "action.selected" : undefined,
              }}
            >
              {label}
            </Button>
          );
        })}
      </Stack>
      <Drawer
        anchor="left"
        open={open && mobile}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-modal": true,
            "aria-label": "Main navigation",
            sx: {
              width: { xs: "100%", sm: 320 },
              maxWidth: "100%",
              borderRight: 0,
            },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: 2, sm: 3 },
            minHeight: "var(--application-header-height)",
            flexShrink: 0,
            boxSizing: "border-box",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Logo onClick={() => setOpen(false)} />
          <IconButton
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <Close />
          </IconButton>
        </Stack>
        <Box
          component="nav"
          id={id}
          aria-label="Mobile navigation"
          sx={{ p: 1.5 }}
        >
          <List disablePadding>
            {mobileLinks.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/account" && pathname.startsWith(`${href}/`));

              return (
                <ListItemButton
                  key={href}
                  component="a"
                  href={href}
                  selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  sx={{
                    borderRadius: 1,
                    minHeight: 52,
                    mb: 0.5,
                    color: active ? "primary.main" : "text.primary",
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                    <Icon />
                  </ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              );
            })}
          </List>
          {!signedIn && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Button
                href="/sign-in"
                variant="contained"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Button>
              <Button
                href="/register"
                variant="outlined"
                onClick={() => setOpen(false)}
              >
                Create account
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>
    </>
  );
}
