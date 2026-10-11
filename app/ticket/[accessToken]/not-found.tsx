"use client";

import { Container, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

export default function TicketNotFound() {
  const t = useTranslations("shell");

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("ticketUnavailable")}
      </Typography>
      <Typography color="text.secondary">
        {t("privateLinkUnavailable")}
      </Typography>
    </Container>
  );
}
