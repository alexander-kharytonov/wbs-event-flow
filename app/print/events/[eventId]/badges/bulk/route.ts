import { z } from "zod";
import { badgePrintRequestSchema } from "@/features/badges/print-request";
import { buildBulkBadgeDocument } from "@/features/badges/server/bulk";
import {
  badgeHtmlResponse,
  badgePrintHeaders,
} from "@/features/badges/server/print-html";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const invalid =
  "The print request is unavailable. Refresh the workspace and try again.";
type Context = { params: Promise<{ eventId: string }> };

async function selectedInput(request: Request) {
  const contentType = request.headers.get("content-type");

  if (
    !contentType ||
    !/^application\/x-www-form-urlencoded(?:;\s*charset=utf-8)?$/i.test(
      contentType,
    )
  ) {
    return null;
  }

  const declaredLength = request.headers.get("content-length");

  if (
    declaredLength &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)
  ) {
    return null;
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return null;
  }

  let size = 0;
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel();

        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks),
  );

  if (/%(?![0-9a-f]{2})/i.test(body)) {
    return null;
  }

  const fields = new URLSearchParams(body);

  if (
    [...fields.keys()].some((key) => key !== "mode" && key !== "attendeeId") ||
    fields.getAll("mode").length !== 1 ||
    fields.get("mode") !== "SELECTED"
  ) {
    return null;
  }

  return { mode: "SELECTED", ids: fields.getAll("attendeeId") };
}

async function handle(request: Request, context: Context, post: boolean) {
  let eventId = "";

  try {
    eventId = (await context.params).eventId;

    if (!z.uuid().safeParse(eventId).success) {
      return await badgeHtmlResponse({ error: invalid }, "", 400);
    }

    // Session-authenticated native POST does not inherit Server Action CSRF checks.
    if (
      post &&
      (request.headers.get("origin") !== getServerEnv().BETTER_AUTH_URL ||
        ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")))
    ) {
      return await badgeHtmlResponse({ error: invalid }, eventId, 403);
    }

    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });

    if (
      !session?.user.emailVerified ||
      session.session.expiresAt.getTime() <= Date.now()
    ) {
      return await badgeHtmlResponse({ error: invalid }, eventId, 403);
    }

    let input: unknown;

    if (post) {
      input = await selectedInput(request);
    } else {
      const query = new URL(request.url).searchParams;
      const keys = [...query.keys()];

      if (
        keys.some((key) => !["mode", "createdAt", "id"].includes(key)) ||
        new Set(keys).size !== keys.length
      ) {
        return await badgeHtmlResponse({ error: invalid }, eventId, 400);
      }

      input =
        query.get("mode") === "TEAM" && keys.length === 1
          ? { mode: "TEAM" }
          : {
              mode: query.get("mode"),
              ...(query.has("createdAt") || query.has("id")
                ? {
                    cursor: {
                      createdAt: query.get("createdAt"),
                      id: query.get("id"),
                    },
                  }
                : {}),
            };
    }

    const parsed = badgePrintRequestSchema.safeParse(input);

    if (!parsed.success || (!post && parsed.data.mode === "SELECTED")) {
      return await badgeHtmlResponse(
        {
          error:
            "Choose between 1 and 200 unique attendees, or open a valid print batch.",
        },
        eventId,
        400,
      );
    }

    const result = await buildBulkBadgeDocument(
      { userId: session.user.id },
      eventId,
      parsed.data,
    );

    return await badgeHtmlResponse(
      result,
      eventId,
      "error" in result ? 409 : 200,
    );
  } catch {
    // Do not log request bodies, credentials, or underlying crypto/renderer errors.
    return new Response(
      '<!doctype html><html lang="en"><head><title>Print unavailable</title></head><body><p>Could not prepare the print document. Please open it again.</p></body></html>',
      { status: 500, headers: badgePrintHeaders },
    );
  }
}

export async function POST(request: Request, context: Context) {
  return handle(request, context, true);
}

export async function GET(request: Request, context: Context) {
  return handle(request, context, false);
}
