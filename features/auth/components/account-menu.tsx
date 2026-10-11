"use client";

import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import Logout from "@mui/icons-material/Logout";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import {
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
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { requestEditorLeave } from "@/components/ui/editor-navigation-guard";
import { ShellText } from "@/components/ui/shell-text";
import { AccountAvatar } from "@/features/auth/components/account-avatar";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({
  name,
  image,
  organizerProfileId,
  hasAssignedEvents = false,
}: {
  name: string;
  image?: string | null;
  organizerProfileId?: string;
  hasAssignedEvents?: boolean;
}) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);
  const notifications = useNotifications();
  const id = useId();
  const accountLinks = [
    { href: "/account", label: t("account"), icon: AccountCircleOutlined },
    {
      href: "/account/registrations",
      label: t("registrations"),
      icon: EventAvailableOutlined,
    },
    { href: "/account/profile", label: t("profile"), icon: PersonOutlined },
  ];
  const hasWorkspace = Boolean(organizerProfileId || hasAssignedEvents);
  const workspaceHref = hasWorkspace ? "/dashboard" : "/onboarding/organizer";
  const workspaceActive =
    pathname === workspaceHref || pathname.startsWith(`${workspaceHref}/`);
  async function signOut(navigate: (action: () => void) => void) {
    setPending(true);
    notifications.close("sign-out");

    try {
      const result = await authClient.signOut();

      if (result.error) {
        notifications.show(<ShellText id="signOutFailed" />, {
          severity: "error",
          key: "sign-out",
        });

        return;
      }

      navigate(() => window.location.assign("/"));
    } catch {
      notifications.show(<ShellText id="signOutFailed" />, {
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
        aria-label={t("accountMenu", { name })}
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
        <AccountAvatar name={name} image={image} />
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
            {hasWorkspace ? t("dashboard") : t("becomeOrganizer")}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() =>
            requestEditorLeave((navigate) => void signOut(navigate))
          }
          disabled={pending}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {pending ? t("signingOut") : t("signOut")}
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
