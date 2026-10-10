"use client";

import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import QuizOutlined from "@mui/icons-material/QuizOutlined";
import SpaceDashboardOutlined from "@mui/icons-material/SpaceDashboardOutlined";
import SupervisorAccountOutlined from "@mui/icons-material/SupervisorAccountOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { Badge, Box, Tab } from "@mui/material";
import Link from "next/link";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";

type Section =
  | "overview"
  | "registration-form"
  | "preview"
  | "staff"
  | "badges"
  | "applications"
  | "attendees"
  | "communications"
  | "check-in";

const icons = {
  overview: <SpaceDashboardOutlined fontSize="small" />,
  "registration-form": <QuizOutlined fontSize="small" />,
  preview: <VisibilityOutlined fontSize="small" />,
  staff: <SupervisorAccountOutlined fontSize="small" />,
  applications: <FactCheckOutlined fontSize="small" />,
  attendees: <PeopleOutlined fontSize="small" />,
  badges: <BadgeOutlined fontSize="small" />,
  "check-in": <QrCodeScannerOutlined fontSize="small" />,
  communications: <EmailOutlined fontSize="small" />,
} satisfies Record<Section, React.ReactElement>;

export function EventNavigation({
  eventId,
  active,
  sections,
  applicationCount,
  attendeeCount,
}: {
  eventId: string;
  active: Section;
  sections: { id: Section; label: string }[];
  applicationCount?: number;
  attendeeCount: number;
}) {
  return (
    <Box
      component="nav"
      aria-label="Event sections"
      sx={{ minWidth: 0, display: "flex", position: { md: "sticky" }, top: 24 }}
    >
      <WorkspaceTabs value={active} aria-label="Event sections">
        {sections.map(({ id, label }) => {
          const count =
            id === "applications"
              ? applicationCount
              : id === "attendees"
                ? attendeeCount
                : undefined;

          return (
            <Tab
              key={id}
              id={`event-nav-${id}`}
              aria-controls={active === id ? "event-section-panel" : undefined}
              value={id}
              component={Link}
              href={`/dashboard/events/${eventId}${id === "overview" ? "" : `/${id}`}`}
              aria-current={active === id ? "page" : undefined}
              aria-label={count === undefined ? label : `${label} (${count})`}
              icon={icons[id]}
              iconPosition="start"
              sx={{ pr: count === undefined ? 3 : 5 }}
              label={
                count === undefined ? (
                  label
                ) : (
                  <Badge
                    badgeContent={count}
                    color="primary"
                    showZero
                    sx={{ "& .MuiBadge-badge": { right: -12 } }}
                  >
                    {label}
                  </Badge>
                )
              }
            />
          );
        })}
      </WorkspaceTabs>
    </Box>
  );
}
