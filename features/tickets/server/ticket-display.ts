import "server-only";
import QRCode from "qrcode";
import type { Prisma } from "@/generated/prisma/client";
import { decryptTicketSecret } from "@/lib/ticket-crypto";

// Server-only input selection. Never pass this record through component props.
export const ticketDisplaySelect = {
  number: true,
  attendeeId: true,
  issuedAt: true,
  revokedAt: true,
  credentialHash: true,
  credentialEncrypted: true,
} satisfies Prisma.TicketSelect;

type TicketDisplay = Prisma.TicketGetPayload<{
  select: typeof ticketDisplaySelect;
}>;

async function ticketQrSvg(ticket: TicketDisplay) {
  const credential = decryptTicketSecret(
    ticket.credentialEncrypted,
    ticket.attendeeId,
    "credential",
    ticket.credentialHash,
  );

  return QRCode.toString(`eventflow:ticket:v1:${credential}`, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 240,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export type TicketPresentation = {
  number: string;
  issuedAt: Date;
  checkedInAt: Date | null;
  revokedAt: Date | null;
  attendeeName: string;
  attendeeEmail: string | null;
  context: {
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
  } | null;
  revoked: boolean;
  cancelled: boolean;
  completed: boolean;
  qrDataUrl: string | null;
};

// Explicit projection keeps database records and secrets before the JSX boundary.
export async function presentTicket(
  ticket: TicketDisplay,
  admission: {
    name: string;
    email: string | null;
    revokedAt: Date | null;
    attendance: { checkedInAt: Date } | null;
  },
  context: TicketPresentation["context"],
  cancelledAt: Date | null,
  completed: boolean,
): Promise<TicketPresentation> {
  const revoked = Boolean(ticket.revokedAt || admission.revokedAt);
  const svg = !revoked && !cancelledAt ? await ticketQrSvg(ticket) : null;

  return {
    number: ticket.number,
    issuedAt: ticket.issuedAt,
    checkedInAt: admission.attendance?.checkedInAt ?? null,
    revokedAt: ticket.revokedAt,
    attendeeName: admission.name,
    attendeeEmail: admission.email,
    context: context
      ? {
          title: context.title,
          startsAt: context.startsAt,
          endsAt: context.endsAt,
          timezone: context.timezone,
        }
      : null,
    revoked,
    cancelled: Boolean(cancelledAt),
    completed,
    qrDataUrl: svg
      ? `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
      : null,
  };
}
