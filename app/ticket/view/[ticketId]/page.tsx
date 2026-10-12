import { Alert, Container, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { LanguageSelector } from "@/components/ui/language-selector";
import { EventText } from "@/features/events/components/event-text";
import { PartyGuests } from "@/features/guests/components/party-guests";
import { addGuest, removeGuest } from "@/features/guests/server/manage-guests";
import { TicketCard } from "@/features/tickets/components/ticket-card";
import { getAnonymousTicket } from "@/features/tickets/server/get-anonymous-ticket";
import {
  isTicketMutationOrigin,
  readTicketSession,
} from "@/features/tickets/server/ticket-session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");

  return {
    title: `${t("yourTicket")} | Event Flow`,
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
  };
}

export default async function AnonymousTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  await connection();
  const { ticketId } = await params;
  const accessToken = await readTicketSession(ticketId);
  const data = accessToken ? await getAnonymousTicket(accessToken) : null;

  if (!data) {
    return (
      <Container component="main" maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">
          <EventText id="ticketSessionUnavailable" />
        </Alert>
      </Container>
    );
  }

  // Bind only the nonsecret Ticket id; authorize the current cookie on every mutation.
  async function add(input: { name: string; email: string }) {
    "use server";

    const capability = await readTicketSession(ticketId);

    if (!capability || !isTicketMutationOrigin(await headers())) {
      return { code: "UNAVAILABLE" as const };
    }

    const result = await addGuest({ capability }, input);
    refresh();

    return result;
  }

  async function remove(guestId: string) {
    "use server";

    const capability = await readTicketSession(ticketId);

    if (!capability || !isTicketMutationOrigin(await headers())) {
      return { code: "UNAVAILABLE" as const };
    }

    const result = await removeGuest({ capability }, guestId);
    refresh();

    return result;
  }

  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Stack spacing={3}>
        <LanguageSelector />
        <Typography variant="h4" component="h1">
          <EventText id="yourTicket" />
        </Typography>
        <Alert severity="info">
          <EventText id="privateTicketHint" />
        </Alert>
        {data.cancelledAt && data.cancellationReason && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
            {data.cancellationReason}
          </Alert>
        )}
        <TicketCard ticket={data.ticket} />
        {data.canWithdrawApplication && (
          <Alert severity="info">
            <EventText id="applicationAccessHint" />
          </Alert>
        )}
        <PartyGuests
          party={data.guests}
          addAction={add}
          removeAction={remove}
        />
      </Stack>
    </Container>
  );
}
