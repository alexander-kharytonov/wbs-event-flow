"use client";

import Logout from "@mui/icons-material/Logout";
import {
  Avatar,
  ButtonBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { useId, useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({ name }: { name: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);
  const notifications = useNotifications();
  const id = useId();
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
          borderRadius: 2,
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
          sx={{ display: { xs: "none", sm: "inline" } }}
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
                bgcolor: "background.paper",
                transform: "translateY(-50%) rotate(45deg)",
              },
            },
          },
        }}
      >
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
