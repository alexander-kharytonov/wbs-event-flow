"use client";

import Close from "@mui/icons-material/Close";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function CommunicationDialog({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      open
      onClose={() => router.back()}
      maxWidth="md"
      fullWidth
      aria-labelledby="communication-dialog-title"
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
      <DialogTitle id="communication-dialog-title" sx={{ pr: 7 }}>
        Communication details
        <IconButton
          aria-label="Close communication"
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

// Replacing recipient pages keeps Close/Back one step away from History.
export function RecipientPageLink({
  href,
  modal,
  children,
}: {
  href: string;
  modal: boolean;
  children: ReactNode;
}) {
  return (
    <Button component={NextLink} href={href} replace={modal} scroll={false}>
      {children}
    </Button>
  );
}
