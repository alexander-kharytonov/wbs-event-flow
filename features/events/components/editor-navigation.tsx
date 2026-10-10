"use client";

import EventOutlined from "@mui/icons-material/EventOutlined";
import FormatListBulletedOutlined from "@mui/icons-material/FormatListBulletedOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SubjectOutlined from "@mui/icons-material/SubjectOutlined";
import {
  Badge,
  Box,
  IconButton,
  Popover,
  Tab,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import {
  type EditorSection,
  editorSections,
  errorSection,
} from "@/features/events/editor-state";

const icons = {
  basics: <SubjectOutlined fontSize="small" />,
  cover: <ImageOutlined fontSize="small" />,
  schedule: <EventOutlined fontSize="small" />,
  location: <LocationOnOutlined fontSize="small" />,
  agenda: <FormatListBulletedOutlined fontSize="small" />,
  registration: <PeopleOutlined fontSize="small" />,
  organizer: <PersonOutlined fontSize="small" />,
  additional: <SettingsOutlined fontSize="small" />,
};

export function EditorNavigation({
  section,
  onChange,
  errors,
  coverEnabled,
  hasAdditionalSettings,
}: {
  section: EditorSection;
  onChange: (section: EditorSection) => void;
  errors: Record<string, string>;
  coverEnabled: boolean;
  hasAdditionalSettings: boolean;
}) {
  const [helpAnchor, setHelpAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box
      component="nav"
      aria-label="Editor sections"
      sx={{
        position: { xs: "relative", md: "sticky" },
        top: { md: 24 },
        display: "flex",
        alignItems: "flex-start",
        minWidth: 0,
      }}
    >
      <WorkspaceTabs
        value={section}
        onChange={(_, next: EditorSection) => onChange(next)}
        selectionFollowsFocus
        aria-label="Event editor sections"
      >
        {editorSections.map(({ id, label }) => {
          if (id === "additional" && !hasAdditionalSettings) {
            return null;
          }

          const count = Object.keys(errors).filter(
            (field) => errorSection(field) === id,
          ).length;

          return (
            <Tab
              key={id}
              value={id}
              id={`editor-nav-${id}`}
              aria-controls={`editor-panel-${id}`}
              aria-label={count ? `${label}, ${count} errors` : label}
              disabled={id === "cover" && !coverEnabled}
              icon={icons[id]}
              iconPosition="start"
              label={
                <Badge
                  badgeContent={count}
                  color="error"
                  sx={{ "& .MuiBadge-badge": { right: -12 } }}
                >
                  {label}
                </Badge>
              }
              sx={{
                color: count ? "error.main" : undefined,
                pr: {
                  xs: count ? 5 : 3,
                  md: id === "cover" && !coverEnabled ? 7 : count ? 5 : 3,
                },
              }}
            />
          );
        })}
      </WorkspaceTabs>
      {!coverEnabled && (
        <>
          <Tooltip title="Why is Cover unavailable?">
            <IconButton
              aria-label="Why is Cover unavailable?"
              aria-haspopup="dialog"
              aria-expanded={Boolean(helpAnchor)}
              aria-controls={helpAnchor ? "editor-cover-help" : undefined}
              onClick={(event) => setHelpAnchor(event.currentTarget)}
              size="small"
              sx={{
                position: { md: "absolute" },
                top: { md: 62 },
                right: { md: 8 },
                mt: { xs: 0.75, md: 0 },
              }}
            >
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            id="editor-cover-help"
            open={Boolean(helpAnchor)}
            anchorEl={helpAnchor}
            onClose={() => setHelpAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            <Box
              role="dialog"
              aria-label="Cover availability"
              tabIndex={-1}
              sx={{ p: 2, maxWidth: 320 }}
            >
              <Typography variant="body2">
                Cover image will be available after you create the event. You
                can upload and crop it before publishing.
              </Typography>
            </Box>
          </Popover>
        </>
      )}
    </Box>
  );
}
