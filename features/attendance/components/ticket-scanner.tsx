"use client";

import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
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
  const decoder = useRef<QrScanner | null>(null);
  const media = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const phase = useRef<ScannerState>("IDLE");
  const generation = useRef(0);
  const [state, setState] = useState<ScannerState>("IDLE");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopCamera = useCallback(() => {
    const element = video.current;
    // The decoder may replace the stream when a backgrounded tab resumes.
    const currentStream = decoder.current?.$video.srcObject;

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

    decoder.current?.destroy();
    decoder.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current += 1;
      stopCamera();
    };
  }, [stopCamera]);

  function changeState(next: ScannerState) {
    phase.current = next;
    setState(next);
  }

  async function start() {
    if (["STARTING", "SCANNING", "PROCESSING"].includes(phase.current)) {
      return;
    }

    const run = ++generation.current;
    const current = () => mounted.current && generation.current === run;
    changeState("STARTING");
    setResult(null);
    setError(null);

    try {
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
        video: { facingMode: { ideal: "environment" } },
      });

      if (!current() || !video.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        return;
      }

      media.current = stream;
      video.current.srcObject = stream;

      for (const track of stream.getVideoTracks()) {
        track.addEventListener(
          "ended",
          () => {
            if (current() && phase.current === "SCANNING") {
              stopCamera();
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
          stopCamera();

          try {
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
          preferredCamera: "environment",
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

            stopCamera();
            setError(
              "The scanner could not read the camera. Please start it again.",
            );
            changeState("ERROR");
          },
        },
      );
      decoder.current = scanner;
      changeState("SCANNING");
      await scanner.start();
    } catch (failure) {
      if (!current()) {
        return;
      }

      stopCamera();
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
              stopCamera();
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
            onClick={start}
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
