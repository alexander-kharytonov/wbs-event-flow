"use client";

import Add from "@mui/icons-material/Add";
import { Button } from "@mui/material";
import NextLink from "next/link";
import { useTranslations } from "next-intl";

export function CreateEventButton() {
  const t = useTranslations("events");

  return (
    <Button
      component={NextLink}
      href="/dashboard/events/new"
      scroll={false}
      variant="contained"
      startIcon={<Add />}
    >
      {t("createEvent")}
    </Button>
  );
}
