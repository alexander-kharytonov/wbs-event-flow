"use client";

import EventOutlined from "@mui/icons-material/EventOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import SpaceDashboardOutlined from "@mui/icons-material/SpaceDashboardOutlined";
import { Box, Tab } from "@mui/material";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";

const sections = [
  {
    id: "overview",
    label: "overview",
    href: "/account",
    icon: <SpaceDashboardOutlined fontSize="small" />,
  },
  {
    id: "registrations",
    label: "registrations",
    href: "/account/registrations",
    icon: <EventOutlined fontSize="small" />,
  },
  {
    id: "profile",
    label: "profile",
    href: "/account/profile",
    icon: <PersonOutlined fontSize="small" />,
  },
] as const;

export function AccountNavigation({
  active,
}: {
  active: (typeof sections)[number]["id"];
}) {
  const t = useTranslations("shell");

  return (
    <Box
      component="nav"
      aria-label={t("accountSections")}
      sx={{
        position: { md: "sticky" },
        top: { md: 24 },
        display: "flex",
        minWidth: 0,
      }}
    >
      <WorkspaceTabs value={active} aria-label={t("accountSections")}>
        {sections.map(({ id, label, href, icon }) => (
          <Tab
            key={id}
            value={id}
            id={`account-nav-${id}`}
            aria-controls={active === id ? "account-panel" : undefined}
            aria-current={active === id ? "page" : undefined}
            component={Link}
            href={href}
            label={t(label)}
            icon={icon}
            iconPosition="start"
            sx={{ pr: 3 }}
          />
        ))}
      </WorkspaceTabs>
    </Box>
  );
}
