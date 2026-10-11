import { Alert, Container, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PartyGuests } from "@/features/guests/components/party-guests";
import { addGuest, removeGuest } from "@/features/guests/server/manage-guests";
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

  // Captured capability is encrypted by Next, never passed as a presentation prop.
  async function add(input: { name: string; email: string }) {
    "use server";

    const result = await addGuest({ capability: accessToken }, input);
    refresh();

    return result;
  }

  async function remove(guestId: string) {
    "use server";

    const result = await removeGuest({ capability: accessToken }, guestId);
    refresh();

    return result;
  }

  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          Your ticket
        </Typography>
        <Alert severity="info">
          This private link lets you view tickets and manage guests for your
          registration. Keep it safe.
        </Alert>
        {data.cancelledAt && data.cancellationReason && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
            {data.cancellationReason}
          </Alert>
        )}
        <TicketCard ticket={data.ticket} />
        <PartyGuests
          party={data.guests}
          addAction={add}
          removeAction={remove}
        />
      </Stack>
    </Container>
  );
}
