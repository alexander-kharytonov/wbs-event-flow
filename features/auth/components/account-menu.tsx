"use client";

import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import Logout from "@mui/icons-material/Logout";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import {
  Avatar,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({
  name,
  organizerProfileId,
  hasAssignedEvents = false,
}: {
  name: string;
  organizerProfileId?: string;
  hasAssignedEvents?: boolean;
}) {
  const pathname = usePathname();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);
  const notifications = useNotifications();
  const id = useId();
  const accountLinks = [
    { href: "/account", label: "My account", icon: AccountCircleOutlined },
    {
      href: "/account/registrations",
      label: "My registrations",
      icon: EventAvailableOutlined,
    },
    { href: "/account/profile", label: "Profile", icon: PersonOutlined },
  ];
  const hasWorkspace = Boolean(organizerProfileId || hasAssignedEvents);
  const workspaceHref = hasWorkspace ? "/dashboard" : "/onboarding/organizer";
  const workspaceActive =
    pathname === workspaceHref || pathname.startsWith(`${workspaceHref}/`);
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  const initials = [
    parts[0],
    ...(parts.length > 1 ? [parts[parts.length - 1]] : []),
  ]
    .map((part) => Array.from(part ?? "")[0] ?? "")
    .join("")
    .toUpperCase();
  let colorHash = 0;

  for (const character of initials) {
    colorHash = (colorHash * 31 + (character.codePointAt(0) ?? 0)) % 360;
  }

  async function signOut() {
    setPending(true);
    notifications.close("sign-out");

    try {
      const result = await authClient.signOut();

      if (result.error) {
        notifications.show("Could not sign out. Please try again.", {
          severity: "error",
          key: "sign-out",
        });

        return;
      }

      window.location.assign("/");
    } catch {
      notifications.show("Could not sign out. Please try again.", {
        severity: "error",
        key: "sign-out",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ButtonBase
        id={`${id}-trigger`}
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-controls={anchor ? id : undefined}
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          gap: 1.25,
          p: 0.5,
          maxWidth: "100%",
          "&.Mui-focusVisible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          component="span"
          variant="body2"
          title={name}
          noWrap
          sx={{ display: { xs: "none", sm: "inline" }, maxWidth: 180 }}
        >
          {name}
        </Typography>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            fontSize: 14,
            fontWeight: 600,
            bgcolor: `hsl(${colorHash}, 55%, 32%)`,
            color: "#fff",
          }}
        >
          {initials}
        </Avatar>
      </ButtonBase>
      <Menu
        id={id}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{
          list: { "aria-labelledby": `${id}-trigger` },
          paper: {
            sx: {
              mt: 1.5,
              border: 1,
              borderColor: "divider",
              minWidth: 180,
              overflow: "visible",
              "&::before": {
                content: '""',
                display: "block",
                position: "absolute",
                top: 0,
                right: 18,
                width: 10,
                height: 10,
                bgcolor: "inherit",
                borderTop: "1px solid",
                borderLeft: "1px solid",
                borderColor: "inherit",
                transform: "translateY(-50%) rotate(45deg)",
              },
            },
          },
        }}
      >
        {accountLinks.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/account" && pathname.startsWith(`${href}/`));

          return (
            <MenuItem
              key={href}
              component={NextLink}
              href={href}
              selected={active}
              aria-current={active ? "page" : undefined}
              onClick={() => setAnchor(null)}
              sx={{ color: active ? "primary.main" : "text.primary" }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{label}</ListItemText>
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem
          component={NextLink}
          href={workspaceHref}
          selected={workspaceActive}
          aria-current={workspaceActive ? "page" : undefined}
          sx={{ color: workspaceActive ? "primary.main" : "text.primary" }}
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            {hasWorkspace ? (
              <DashboardOutlined fontSize="small" />
            ) : (
              <EventAvailableOutlined fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {hasWorkspace ? "Dashboard" : "Become an organizer"}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={signOut} disabled={pending}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>{pending ? "Signing out…" : "Sign out"}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
