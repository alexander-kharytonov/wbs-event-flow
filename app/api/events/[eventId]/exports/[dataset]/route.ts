import { z } from "zod";
import { ExportError } from "@/features/exports/csv";
import { buildEventCsv } from "@/features/exports/server/event-export";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const datasetSchema = z.enum([
  "applications",
  "attendees",
  "attendance",
  "staff",
]);

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      ...responseHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string; dataset: string }> },
) {
  try {
    const params = await context.params;
    const dataset = datasetSchema.safeParse(params.dataset);

    if (!z.uuid().safeParse(params.eventId).success || !dataset.success) {
      return errorResponse("Export unavailable.", 404);
    }

    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });

    if (
      !session?.user.emailVerified ||
      session.session.expiresAt.getTime() <= Date.now()
    ) {
      return errorResponse("Export unavailable.", 404);
    }

    const result = await buildEventCsv(
      session.user.id,
      params.eventId,
      dataset.data,
    );

    if (!result) {
      return errorResponse("Export unavailable.", 404);
    }

    return new Response(result.csv, {
      headers: {
        ...responseHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof ExportError
        ? error.message
        : "Could not prepare the export. Please try again.",
      error instanceof ExportError ? 409 : 500,
    );
  }
}
