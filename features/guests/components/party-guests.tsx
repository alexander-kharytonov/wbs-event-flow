import "server-only";
import { EventText } from "@/features/events/components/event-text";
import { PartyGuestsControls } from "@/features/guests/components/party-guests-controls";
import type { GuestResult } from "@/features/guests/guest-result";
import type { PartyGuestsPresentation } from "@/features/guests/server/party-presentation";
import { TicketCard } from "@/features/tickets/components/ticket-card";

export function PartyGuests({
  party,
  removeAction,
}: {
  party: PartyGuestsPresentation;
  removeAction: (guestId: string) => Promise<GuestResult>;
}) {
  if (!party.showSection) {
    return null;
  }

  return (
    <PartyGuestsControls
      party={{
        ...party,
        items: party.items.map(({ id, active }) => ({ id, active })),
      }}
      cards={party.items.map((guest) => (
        <TicketCard
          key={guest.id}
          ticket={guest.ticket}
          title={<EventText id="guestTicket" />}
        />
      ))}
      removeAction={removeAction}
    />
  );
}
