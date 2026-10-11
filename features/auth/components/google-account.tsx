"use client";

import Google from "@mui/icons-material/Google";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { requestEditorLeave } from "@/components/ui/editor-navigation-guard";
import { authClient } from "@/lib/auth-client";

export function GoogleAccount({
  userId,
  accountId,
  canDisconnect,
  enabled,
  error,
}: {
  userId: string;
  accountId?: string;
  canDisconnect: boolean;
  enabled: boolean;
  error?: string;
}) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reauthenticate, setReauthenticate] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const restore = () => {
      setPending(false);
      inFlight.current = false;
    };
    window.addEventListener("pageshow", restore);

    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function manage(navigate: (action: () => void) => void) {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setPending(true);
    setFailed(false);
    setReauthenticate(false);
    setConfirm(false);

    try {
      if (accountId) {
        const result = await authClient.unlinkAccount({ accountId });

        if (result.error) {
          setReauthenticate(
            [
              "SESSION_NOT_FRESH",
              "LINK_SESSION_REQUIRED",
              "UNAUTHORIZED",
            ].includes(result.error.code ?? ""),
          );
          setFailed(true);
        } else {
          navigate(() => window.location.assign("/account/profile"));
        }
      } else {
        const result = await authClient.linkSocial({
          provider: "google",
          callbackURL: "/account/profile",
          errorCallbackURL: "/account/profile",
          additionalData: { expectedUserId: userId },
          disableRedirect: true,
        });

        if (result.error || !result.data?.url) {
          setFailed(true);
        } else {
          navigate(() => window.location.assign(result.data.url));
        }
      }
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Typography variant="h6" component="h2">
        {t("loginMethods")}
      </Typography>
      <Typography color="text.secondary">
        {t(accountId ? "googleConnected" : "googleConnectDescription")}
      </Typography>
      {(failed || error) && (
        <Alert severity="error">
          {t(
            reauthenticate || error === "link_session_required"
              ? "googleReauthenticate"
              : error === "access_denied"
                ? "googleCancelled"
                : "googleFailed",
          )}
        </Alert>
      )}
      {accountId && !canDisconnect && (
        <Alert severity="info">{t("googleLastMethod")}</Alert>
      )}
      {!enabled && !accountId && (
        <Alert severity="info">{t("googleUnavailable")}</Alert>
      )}
      <Button
        variant="outlined"
        startIcon={<Google />}
        loading={pending}
        disabled={accountId ? !canDisconnect : !enabled}
        sx={{ alignSelf: "flex-start" }}
        onClick={() =>
          accountId
            ? setConfirm(true)
            : requestEditorLeave((navigate) => void manage(navigate))
        }
      >
        {t(accountId ? "googleDisconnect" : "googleConnect")}
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        aria-labelledby="disconnect-google-title"
      >
        <DialogTitle id="disconnect-google-title">
          {t("googleDisconnect")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t("googleDisconnectConfirm")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>{t("cancel")}</Button>
          <Button
            onClick={() => {
              setConfirm(false);
              requestEditorLeave((navigate) => void manage(navigate));
            }}
          >
            {t("googleDisconnect")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
