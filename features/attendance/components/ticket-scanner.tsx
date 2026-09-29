"use client";

import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type QrScanner from "qr-scanner";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckInResult } from "@/features/attendance/check-in-result";
import { checkInTicketAction } from "@/features/attendance/check-in-ticket-action";
import { formatEventTime } from "@/features/events/format-event-time";

type ScannerState =
  | "IDLE"
  | "STARTING"
  | "SCANNING"
  | "PROCESSING"
  | "RESULT"
  | "ERROR";

function resultMessage(result: CheckInResult, timezone: string) {
  switch (result.code) {
    case "CHECKED_IN":
      return "Checked in";
    case "ALREADY_CHECKED_IN":
      return "Already checked in";
    case "INVALID_CREDENTIAL":
      return "Invalid ticket. Scan an Event Flow ticket QR.";
    case "WRONG_EVENT":
      return "This ticket belongs to another event.";
    case "ADMISSION_REVOKED":
      return "This admission is no longer valid.";
    case "EVENT_CANCELLED":
      return "This event is cancelled. New check-ins are unavailable.";
    case "CHECK_IN_NOT_OPEN":
      return `Check-in opens ${formatEventTime(new Date(result.boundaryAt), timezone)} (${timezone}).`;
    case "CHECK_IN_CLOSED":
      return `Check-in closed ${formatEventTime(new Date(result.boundaryAt), timezone)} (${timezone}).`;
    case "UNAVAILABLE":
    case "FAILED":
      return result.message;
  }
}

export function TicketScanner({
  eventId,
  timezone,
}: {
  eventId: string;
  timezone: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const decoder = useRef<{
    scanner: QrScanner;
    pendingPauses: Set<Promise<boolean>>;
  } | null>(null);
  const cleanup = useRef<Promise<void>>(Promise.resolve());
  const media = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const phase = useRef<ScannerState>("IDLE");
  const generation = useRef(0);
  const [state, setState] = useState<ScannerState>("IDLE");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const stopCamera = useCallback(() => {
    const element = video.current;
    // The decoder may replace the stream when a backgrounded tab resumes.
    const previous = decoder.current;
    decoder.current = null;
    const currentStream = previous?.scanner.$video.srcObject;

    if (currentStream instanceof MediaStream) {
      for (const track of currentStream.getTracks()) {
        track.stop();
      }
    }

    if (media.current) {
      for (const track of media.current.getTracks()) {
        track.stop();
      }

      media.current = null;
    }

    if (element) {
      element.srcObject = null;
    }

    if (previous) {
      const overlay = previous.scanner.$overlay;
      previous.scanner.destroy();

      // destroy() calls pause(), which can also have been started by visibility
      // changes. Drain those actual promises before this video can be reused.
      cleanup.current = Promise.all([
        cleanup.current,
        ...previous.pendingPauses,
      ]).then(() => undefined);

      if (overlay) {
        for (const animation of overlay.getAnimations({ subtree: true })) {
          animation.cancel();
        }

        overlay.remove();
      }
    }

    return cleanup.current;
  }, []);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current += 1;
      void stopCamera().catch(() => {});
    };
  }, [stopCamera]);

  function changeState(next: ScannerState) {
    phase.current = next;
    setState(next);
  }

  async function start(selectedCamera = cameraId) {
    if (["STARTING", "SCANNING", "PROCESSING"].includes(phase.current)) {
      return;
    }

    const run = ++generation.current;
    const current = () => mounted.current && generation.current === run;
    changeState("STARTING");
    setResult(null);
    setError(null);

    try {
      await stopCamera();

      if (!current()) {
        return;
      }

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("SECURE_CONTEXT");
      }

      const { default: Scanner } = await import("qr-scanner");

      if (!current() || !video.current) {
        return;
      }

      // Request once so permission errors remain distinguishable from missing hardware.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: selectedCamera
          ? { deviceId: { exact: selectedCamera } }
          : { facingMode: { ideal: "environment" } },
      });

      if (!current() || !video.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        return;
      }

      media.current = stream;
      video.current.srcObject = stream;
      const activeCamera = stream.getVideoTracks()[0]?.getSettings().deviceId;

      // Labels are available after permission. Enumeration must not prevent
      // scanning when the browser can open a camera but cannot list devices.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        if (!current()) {
          return;
        }

        const available = devices.filter(
          (device) => device.kind === "videoinput" && device.deviceId,
        );
        setCameras(available);
        setCameraId(
          available.some((device) => device.deviceId === activeCamera)
            ? (activeCamera ?? "")
            : "",
        );
      } catch {
        // Keep the working stream and any previously enumerated choices.
      }

      if (!current() || !video.current) {
        return;
      }

      for (const track of stream.getVideoTracks()) {
        track.addEventListener(
          "ended",
          () => {
            if (current() && phase.current === "SCANNING") {
              void stopCamera().catch(() => {});
              setError(
                "Camera access ended. Start the scanner again to continue.",
              );
              changeState("ERROR");
            }
          },
          { once: true },
        );
      }

      const scanner = new Scanner(
        video.current,
        async (decoded) => {
          if (!current() || phase.current !== "SCANNING") {
            return;
          }

          // Synchronous gate closes before awaiting the action: one request per explicit scan.
          changeState("PROCESSING");

          try {
            await stopCamera();

            if (!current()) {
              return;
            }

            const response = await checkInTicketAction({
              eventId,
              qrPayload: decoded.data,
            });

            if (current()) {
              setResult(response);
              changeState("RESULT");
            }
          } catch {
            if (current()) {
              setError(
                "Could not complete check-in. Check your connection and sign-in, then scan again.",
              );
              changeState("ERROR");
            }
          }
        },
        {
          preferredCamera: activeCamera || selectedCamera || "environment",
          highlightScanRegion: true,
          maxScansPerSecond: 10,
          returnDetailedScanResult: true,
          onDecodeError: (failure) => {
            if (
              !current() ||
              phase.current !== "SCANNING" ||
              failure === Scanner.NO_QR_CODE_FOUND ||
              failure === `Scanner error: ${Scanner.NO_QR_CODE_FOUND}`
            ) {
              return;
            }

            void stopCamera().catch(() => {});
            setError(
              "The scanner could not read the camera. Please start it again.",
            );
            changeState("ERROR");
          },
        },
      );
      const pendingPauses = new Set<Promise<boolean>>();
      const pause = scanner.pause.bind(scanner);
      // Track the public pause lifecycle, including calls from destroy()/stop()
      // and background-tab handling. No guessed timer or private fields needed.
      scanner.pause = (stopStreamImmediately) => {
        const pending = pause(stopStreamImmediately);
        pendingPauses.add(pending);
        void pending.then(
          () => pendingPauses.delete(pending),
          () => pendingPauses.delete(pending),
        );

        return pending;
      };
      decoder.current = { scanner, pendingPauses };
      changeState("SCANNING");
      await scanner.start();
    } catch (failure) {
      if (!current()) {
        return;
      }

      await stopCamera();

      if (!current()) {
        return;
      }

      const name = failure instanceof Error ? failure.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access was denied. Allow camera access in your browser settings and try again."
          : failure instanceof Error && failure.message === "SECURE_CONTEXT"
            ? "Camera access requires HTTPS or localhost."
            : "Camera unavailable. Check that a camera is connected and not in use by another app.",
      );
      changeState("ERROR");
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 640 }}>
      <Stack spacing={2}>
        <Typography color="text.secondary">
          Scan an attendee’s ticket QR. Camera access starts only when you
          choose Start scanner.
        </Typography>
        {cameras.length > 0 && (
          <TextField
            select
            label="Camera"
            size="small"
            value={cameraId}
            disabled={state === "STARTING" || state === "PROCESSING"}
            onChange={(event) => {
              const selectedCamera = event.target.value;
              setCameraId(selectedCamera);

              if (phase.current === "SCANNING") {
                changeState("IDLE");
                void start(selectedCamera);
              }
            }}
            fullWidth
          >
            <MenuItem value="">Automatic (prefer rear camera)</MenuItem>
            {cameras.map((camera, index) => (
              <MenuItem key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Camera ${index + 1}`}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Box
          sx={{
            position: "relative",
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "action.hover",
            aspectRatio: "4 / 3",
            "& .scan-region-highlight-svg": {
              stroke: "var(--mui-palette-primary-main) !important",
            },
            display:
              state === "SCANNING" || state === "STARTING" ? "block" : "none",
          }}
        >
          <video
            ref={video}
            playsInline
            muted
            aria-label="Ticket scanner camera"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
        <Box aria-live="polite" aria-atomic="true">
          {(state === "STARTING" || state === "PROCESSING") && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} />
              <Typography>
                {state === "STARTING" ? "Starting camera…" : "Checking ticket…"}
              </Typography>
            </Stack>
          )}
          {state === "SCANNING" && (
            <Typography>Point the camera at the ticket QR.</Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert
              severity={
                result.code === "CHECKED_IN"
                  ? "success"
                  : result.code === "ALREADY_CHECKED_IN"
                    ? "info"
                    : "warning"
              }
            >
              <Stack spacing={0.5} sx={{ overflowWrap: "anywhere" }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {resultMessage(result, timezone)}
                </Typography>
                {"attendee" in result && (
                  <>
                    <Typography>{result.attendee.attendeeName}</Typography>
                    <Typography variant="body2">
                      {result.attendee.attendeeEmail}
                    </Typography>
                    <Typography variant="body2">
                      {result.attendee.ticketNumber}
                    </Typography>
                  </>
                )}
                {"checkedInAt" in result && (
                  <Typography variant="body2">
                    {formatEventTime(new Date(result.checkedInAt), timezone)} (
                    {timezone})
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}
        </Box>
        {state === "SCANNING" ? (
          <Button
            variant="outlined"
            onClick={() => {
              generation.current += 1;
              void stopCamera().catch(() => {});
              changeState("IDLE");
            }}
            sx={{ alignSelf: "flex-start" }}
          >
            Stop scanner
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<QrCodeScannerOutlined />}
            disabled={state === "STARTING" || state === "PROCESSING"}
            onClick={() => void start()}
            sx={{ alignSelf: "flex-start" }}
          >
            {state === "RESULT" || state === "ERROR"
              ? "Scan next"
              : "Start scanner"}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
