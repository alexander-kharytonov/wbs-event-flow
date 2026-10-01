import { z } from "zod";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { prisma } from "@/lib/prisma";
import { applicationStreamResponse } from "@/lib/realtime/sse-response";
import { getStreamSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const authorized = await getStreamSession(request);

  if (authorized instanceof Response) {
    return authorized;
  }

  const { eventId } = await params;
  const valid = z.uuid().safeParse(eventId);
  const event = valid.success
    ? await authorizeEventActor(
        prisma,
        valid.data,
        authorized.userId,
        "event.context.read",
      )
    : null;

  if (!event) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return applicationStreamResponse(request, { eventId }, authorized.deadline);
}
