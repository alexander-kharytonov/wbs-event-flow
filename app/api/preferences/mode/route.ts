import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isUiMode, modeCookie } from "@/lib/ui-mode";

export async function PUT(request: Request) {
  const origin = new URL(getServerEnv().BETTER_AUTH_URL).origin;

  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }

  let value: unknown;

  try {
    // The only accepted body is a mode string; bound even chunked bodies.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    if (!reader) {
      return NextResponse.json({ code: "invalidMode" }, { status: 400 });
    }

    while (true) {
      const { done, value: chunk } = await reader.read();

      if (done) break;
      size += chunk.byteLength;

      if (size > 64) {
        await reader.cancel();

        return NextResponse.json({ code: "invalidMode" }, { status: 400 });
      }
      chunks.push(chunk);
    }
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return NextResponse.json({ code: "invalidMode" }, { status: 400 });
  }

  if (!isUiMode(value)) {
    return NextResponse.json({ code: "invalidMode" }, { status: 400 });
  }

  try {
    const session = await getSession();

    if (session) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { uiMode: value },
      });
    }
    const response = NextResponse.json(
      { mode: value },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(modeCookie, value, {
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
