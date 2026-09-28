"use client";

import CancelOutlined from "@mui/icons-material/CancelOutlined";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withdrawApplication } from "@/features/events/withdraw-application-action";
import { useNotifications } from "@/hooks/use-notifications";

export function WithdrawApplicationButton({
  publicId,
  applicationId,
}: {
  publicId: string;
  applicationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const notifications = useNotifications();
  const router = useRouter();

  function withdraw() {
    startTransition(async () => {
      try {
        const result = await withdrawApplication({ publicId, applicationId });

        if (!result.success) {
          notifications.show(
            result.message ?? "Could not withdraw your application.",
            { severity: "error" },
          );

          return;
        }

        setOpen(false);
        notifications.show("Application withdrawn.", { severity: "success" });
        router.refresh();
      } catch {
        notifications.show(
          "Could not confirm withdrawal. Reload to check your application.",
          { severity: "error" },
        );
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        color="error"
        variant="outlined"
        startIcon={<CancelOutlined />}
        sx={(theme) => ({
          borderColor: "currentColor",
          ...theme.applyStyles("dark", {
            color: "error.light",
          }),
        })}
      >
        Withdraw application
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        aria-labelledby="withdraw-application-title"
      >
        <DialogTitle id="withdraw-application-title">
          Withdraw your application?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            If your application was approved, your place will be released. You
            can submit a new application while registration is open, but it will
            need organizer review again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={pending}>
            Keep application
          </Button>
          <Button
            onClick={withdraw}
            color="error"
            variant="contained"
            loading={pending}
          >
            Withdraw application
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
