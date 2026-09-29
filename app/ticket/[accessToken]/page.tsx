import { Alert, Container, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TicketCard } from "@/features/tickets/components/ticket-card";
import { getAnonymousTicket } from "@/features/tickets/server/get-anonymous-ticket";

export const metadata: Metadata = {
  title: "Your ticket | Event Flow",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function AnonymousTicketPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  await connection();
  const { accessToken } = await params;
  const data = await getAnonymousTicket(accessToken);

  if (!data) {
    notFound();
  }

  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          Your ticket
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This is your private ticket page. Keep its link safe.
        </Typography>
        {data.cancelledAt && data.cancellationReason && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
            {data.cancellationReason}
          </Alert>
        )}
        <TicketCard ticket={data.ticket} />
      </Stack>
    </Container>
  );
}
