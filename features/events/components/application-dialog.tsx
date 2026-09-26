"use client";

import Close from "@mui/icons-material/Close";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function ApplicationDialog({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      open
      onClose={() => router.back()}
      maxWidth="md"
      fullWidth
      aria-labelledby="application-dialog-title"
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
      <DialogTitle id="application-dialog-title" sx={{ pr: 7 }}>
        Application detail
        <IconButton
          aria-label="Close application"
          onClick={() => router.back()}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
}
