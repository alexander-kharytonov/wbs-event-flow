import { NextResponse } from "next/server";
import {
  eventPasswordCookie,
  eventPasswordSessionSeconds,
  isEventPasswordOrigin,
  sealEventPasswordSession,
} from "@/features/events/server/event-password-session";
import { verifyPublishedEventPassword } from "@/features/events/server/verify-event-password";
import { getServerEnv } from "@/lib/env";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const unavailable = () =>
    NextResponse.json(
      { code: "accessUnavailable" },
      { status: 400, headers: privateHeaders },
    );

  if (!isEventPasswordOrigin(request.headers)) {
    return unavailable();
  }

  try {
    if (request.headers.get("content-type") !== "application/json") {
      return unavailable();
    }
    const reader = request.body?.getReader();

    if (!reader) {
      return unavailable();
    }
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      size += value.byteLength;

      if (size > 1024) {
        await reader.cancel();

        return unavailable();
      }
      chunks.push(value);
    }
    const password: unknown = JSON.parse(
      Buffer.concat(chunks).toString("utf8"),
    );

    if (typeof password !== "string") {
      return unavailable();
    }
    const { publicId } = await params;
    const grant = await verifyPublishedEventPassword(publicId, password);

    if (!grant) {
      return unavailable();
    }
    const response = NextResponse.json(
      { success: true },
      { headers: privateHeaders },
    );
    response.cookies.set(
      eventPasswordCookie(publicId),
      sealEventPasswordSession(publicId, grant.grantId, grant.issuedAt),
      {
        httpOnly: true,
        secure:
          getServerEnv().NODE_ENV === "production" ||
          request.headers.get("origin")?.startsWith("https:") === true,
        sameSite: "strict",
        path: `/e/${publicId}`,
        maxAge: eventPasswordSessionSeconds,
      },
    );

    return response;
  } catch {
    return unavailable();
  }
}
