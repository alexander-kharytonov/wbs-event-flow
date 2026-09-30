import "server-only";
import { PartyGuestsControls } from "@/features/guests/components/party-guests-controls";
import type { GuestResult } from "@/features/guests/guest-result";
import type { PartyGuestsPresentation } from "@/features/guests/server/party-presentation";
import { TicketCard } from "@/features/tickets/components/ticket-card";

export function PartyGuests({
  party,
  addAction,
  removeAction,
}: {
  party: PartyGuestsPresentation;
  addAction: (input: { name: string; email: string }) => Promise<GuestResult>;
  removeAction: (guestId: string) => Promise<GuestResult>;
}) {
  return (
    <PartyGuestsControls
      party={{
        ...party,
        items: party.items.map(({ id, active }) => ({ id, active })),
      }}
      cards={party.items.map((guest) => (
        <TicketCard key={guest.id} ticket={guest.ticket} title="Guest ticket" />
      ))}
      addAction={addAction}
      removeAction={removeAction}
    />
  );
}
