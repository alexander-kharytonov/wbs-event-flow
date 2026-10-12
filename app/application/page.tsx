import { Container } from "@mui/material";
import type { Metadata } from "next";
import { TicketExchange } from "@/features/tickets/components/ticket-exchange";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default function ApplicationEntryPage() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <TicketExchange scope="application" />
    </Container>
  );
}
