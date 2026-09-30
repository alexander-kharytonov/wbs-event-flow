"use client";

import Add from "@mui/icons-material/Add";
import { Button } from "@mui/material";
import NextLink from "next/link";

export function CreateEventButton() {
  return (
    <Button
      component={NextLink}
      href="/dashboard/events/new"
      scroll={false}
      variant="contained"
      startIcon={<Add />}
    >
      Create event
    </Button>
  );
}
