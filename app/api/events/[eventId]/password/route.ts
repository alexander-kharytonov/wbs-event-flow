import { z } from "zod";
import { decryptEventPassword } from "@/features/events/server/event-password-encryption";
import { isEventPasswordOrigin } from "@/features/events/server/event-password-session";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const unavailable = () =>
    Response.json(
      { code: "accessSavedLoadFailed" },
      { status: 404, headers: privateHeaders },
    );

  try {
    if (!isEventPasswordOrigin(request.headers)) {
      return unavailable();
    }
    const { eventId } = await params;
    const version = request.headers.get("x-event-version");

    if (
      !z.uuid().safeParse(eventId).success ||
      !version ||
      version.length > 64
    ) {
      return unavailable();
    }
    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });

    if (
      !session?.user.emailVerified ||
      session.session.expiresAt.getTime() <= Date.now()
    ) {
      return unavailable();
    }
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizer: { userId: session.user.id } },
      select: {
        updatedAt: true,
        draftPasswordHash: true,
        draftPasswordEncrypted: true,
      },
    });

    if (
      !event?.draftPasswordHash ||
      Buffer.from(event.updatedAt.toISOString()).toString("base64url") !==
        version
    ) {
      return unavailable();
    }

    if (!event.draftPasswordEncrypted) {
      return Response.json(
        { code: "accessSavedUnavailable" },
        { status: 409, headers: privateHeaders },
      );
    }
    const password = await decryptEventPassword(
      event.draftPasswordEncrypted,
      eventId,
      event.draftPasswordHash,
    );

    return Response.json({ password }, { headers: privateHeaders });
  } catch {
    return unavailable();
  }
}
