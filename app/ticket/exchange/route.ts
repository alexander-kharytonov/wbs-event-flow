import { NextResponse } from "next/server";
import {
  isTicketMutationOrigin,
  sealTicketSession,
  ticketSessionCookie,
  ticketSessionPath,
  ticketSessionSeconds,
} from "@/features/tickets/server/ticket-session";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { hashTicketSecret, isTicketSecret } from "@/lib/ticket-crypto";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: Request) {
  if (!isTicketMutationOrigin(request.headers)) {
    return NextResponse.json(
      { code: "UNAVAILABLE" },
      { status: 403, headers: privateHeaders },
    );
  }

  try {
    if (request.headers.get("content-type") !== "application/json") {
      return NextResponse.json(
        { code: "UNAVAILABLE" },
        { status: 400, headers: privateHeaders },
      );
    }

    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    if (!reader) {
      return NextResponse.json(
        { code: "UNAVAILABLE" },
        { status: 400, headers: privateHeaders },
      );
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      size += value.byteLength;

      if (size > 128) {
        await reader.cancel();

        return NextResponse.json(
          { code: "UNAVAILABLE" },
          { status: 400, headers: privateHeaders },
        );
      }
      chunks.push(value);
    }

    const capability: unknown = JSON.parse(
      Buffer.concat(chunks).toString("utf8"),
    );

    if (typeof capability !== "string" || !isTicketSecret(capability)) {
      return NextResponse.json(
        { code: "UNAVAILABLE" },
        { status: 400, headers: privateHeaders },
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { anonymousAccessHash: hashTicketSecret(capability) },
      select: { id: true, attendee: { select: { kind: true } } },
    });

    if (ticket?.attendee.kind !== "PRIMARY") {
      return NextResponse.json(
        { code: "UNAVAILABLE" },
        { status: 400, headers: privateHeaders },
      );
    }

    const path = ticketSessionPath(ticket.id);
    const response = NextResponse.json({ path }, { headers: privateHeaders });
    response.cookies.set(
      ticketSessionCookie(),
      sealTicketSession(ticket.id, capability),
      {
        httpOnly: true,
        secure:
          getServerEnv().NODE_ENV === "production" ||
          getServerEnv().BETTER_AUTH_URL.startsWith("https:"),
        sameSite: "strict",
        path,
        maxAge: ticketSessionSeconds,
      },
    );

    return response;
  } catch {
    // Never serialize parser, database or cryptographic exceptions.
    return NextResponse.json(
      { code: "UNAVAILABLE" },
      { status: 400, headers: privateHeaders },
    );
  }
}
