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
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EventText } from "@/features/events/components/event-text";
import {
  withdrawApplication,
  withdrawPrivateApplication,
} from "@/features/events/withdraw-application-action";
import { useNotifications } from "@/hooks/use-notifications";

export function WithdrawApplicationButton({
  publicId,
  applicationId,
  anonymous = false,
}: {
  publicId: string;
  applicationId: string;
  anonymous?: boolean;
}) {
  const t = useTranslations("events");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const notifications = useNotifications();
  const router = useRouter();

  function withdraw() {
    startTransition(async () => {
      try {
        const result = await (anonymous
          ? withdrawPrivateApplication
          : withdrawApplication)({ publicId, applicationId });

        if (!result.success) {
          notifications.show(
            <EventText id={result.message ?? "withdrawFailed"} />,
            { severity: "error" },
          );

          return;
        }

        setOpen(false);
        notifications.show(<EventText id="withdrawSuccess" />, {
          severity: "success",
        });

        if (anonymous) {
          router.replace(`/e/${publicId}/register`);
        } else {
          router.refresh();
        }
      } catch {
        notifications.show(<EventText id="withdrawUnconfirmed" />, {
          severity: "error",
        });
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
        {t("withdrawApplication")}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        aria-labelledby="withdraw-application-title"
      >
        <DialogTitle id="withdraw-application-title">
          {t("withdrawTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t("withdrawHint")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={pending}>
            {t("withdrawKeep")}
          </Button>
          <Button
            onClick={withdraw}
            color="error"
            variant="contained"
            loading={pending}
          >
            {t("withdrawApplication")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
