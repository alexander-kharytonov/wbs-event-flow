import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  EventTemplateError,
  serializeEventTemplate,
} from "@/features/exports/event-template";
import { readEventTemplate } from "@/features/exports/server/event-template";
import { auth } from "@/lib/auth";
import type { Messages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

async function errorResponse(code: keyof Messages["events"], status: number) {
  const t = await getTranslations("events");

  return new Response(t(code), {
    status,
    headers: {
      ...responseHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await context.params;

    if (!z.uuid().safeParse(eventId).success) {
      return errorResponse("exportUnavailable", 404);
    }

    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });

    if (
      !session?.user.emailVerified ||
      session.session.expiresAt.getTime() <= Date.now()
    ) {
      return errorResponse("exportUnavailable", 404);
    }

    const template = await readEventTemplate(session.user.id, eventId);

    if (!template) {
      return errorResponse("exportUnavailable", 404);
    }

    const slug =
      Array.from(
        template.event.title
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-"),
      )
        .slice(0, 80)
        .join("")
        .replace(/^-|-$/g, "") || "event";
    const filename = `${slug}-template.json`;
    const asciiSlug =
      slug.replace(/[^a-z0-9-]+/g, "").replace(/^-+|-+$/g, "") || "event";

    return new Response(serializeEventTemplate(template), {
      headers: {
        ...responseHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiSlug}-template.json"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof EventTemplateError
        ? (
            {
              limits: "exportTemplateLimits",
              binding: "exportTemplateBinding",
              layout: "exportTemplateLayout",
              configuration: "exportTemplateConfiguration",
            } as const
          )[error.code]
        : "exportFailed",
      error instanceof EventTemplateError ? 409 : 500,
    );
  }
}
