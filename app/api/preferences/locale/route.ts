import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { isUiLocale, localeCookie } from "@/lib/i18n/locale";
import { getLocalePreference } from "@/lib/i18n/request";
import {
  getPreferenceSession,
  matchesPreferenceIdentity,
} from "@/lib/preference-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    return NextResponse.json(await getLocalePreference(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { code: "readFailed" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function PUT(request: Request) {
  const origin = new URL(getServerEnv().BETTER_AUTH_URL).origin;

  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }

  let value: unknown;

  try {
    // The only accepted body is a two-letter locale; bound even chunked bodies.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    if (!reader) {
      return NextResponse.json({ code: "invalidLocale" }, { status: 400 });
    }

    while (true) {
      const { done, value: chunk } = await reader.read();

      if (done) break;
      size += chunk.byteLength;

      if (size > 64) {
        await reader.cancel();

        return NextResponse.json({ code: "invalidLocale" }, { status: 400 });
      }
      chunks.push(chunk);
    }
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return NextResponse.json({ code: "invalidLocale" }, { status: 400 });
  }

  if (!isUiLocale(value)) {
    return NextResponse.json({ code: "invalidLocale" }, { status: 400 });
  }

  try {
    const session = await getPreferenceSession();

    if (
      !matchesPreferenceIdentity(
        request.headers.get("X-Preference-Identity"),
        session,
      )
    ) {
      return NextResponse.json(
        { code: "preferenceConflict" },
        { status: 409, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    if (session) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { uiLocale: value },
      });
    }
    const response = NextResponse.json(
      { locale: value },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(localeCookie, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      path: "/",
      maxAge: 31536000,
    });

    return response;
  } catch {
    return NextResponse.json({ code: "saveFailed" }, { status: 500 });
  }
}
