"use client";

import Close from "@mui/icons-material/Close";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function EventFormDialog({
  children,
  title,
  headerActions,
}: {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
}) {
  const router = useRouter();

  return (
    <Dialog
      open
      onClose={() => router.back()}
      maxWidth="md"
      fullWidth
      aria-labelledby="event-form-dialog-title"
      slotProps={{
        paper: {
          sx: {
            m: { xs: 1, sm: 4 },
            width: { xs: "calc(100% - 16px)", sm: "calc(100% - 64px)" },
            maxHeight: { xs: "calc(100% - 16px)", sm: "calc(100% - 64px)" },
          },
        },
      }}
    >
      <DialogTitle
        id="event-form-dialog-title"
        component="div"
        sx={{ overflowWrap: "anywhere" }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Typography component="h2" variant="h6" sx={{ flex: 1, minWidth: 0 }}>
            {title}
          </Typography>
          {headerActions}
          <IconButton
            aria-label="Close event form"
            onClick={() => router.back()}
            sx={{ flexShrink: 0 }}
          >
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
}
