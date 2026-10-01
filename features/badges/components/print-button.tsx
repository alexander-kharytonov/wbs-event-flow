"use client";

import PrintOutlined from "@mui/icons-material/PrintOutlined";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";

export function PrintBadgeButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function print() {
    setBusy(true);
    setError(false);

    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            "[data-badge-document] img",
          ),
        ).map((image) => image.decode()),
      );
      window.print();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={1.5} sx={{ alignItems: "flex-start", maxWidth: 480 }}>
      <Typography variant="h6" component="h1">
        Print badge
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This document uses the layout and admission state from when it was
        opened. Open a new document for current settings. Check paper size and
        scaling in your browser’s print dialog.
      </Typography>
      {error && (
        <Alert severity="error">
          The badge image could not be prepared. Reload the document and try
          again.
        </Alert>
      )}
      <Button
        variant="contained"
        startIcon={<PrintOutlined />}
        loading={busy}
        onClick={print}
      >
        Print
      </Button>
    </Stack>
  );
}
