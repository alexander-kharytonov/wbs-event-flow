import { z } from "zod";
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

  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: authorized.userId },
    select: { id: true },
  });

  if (!organizer) {
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { eventId } = await params;
  const valid = z.uuid().safeParse(eventId);
  const event = valid.success
    ? await prisma.event.findFirst({
        where: { id: valid.data, organizerId: organizer.id },
        select: { id: true },
      })
    : null;

  if (!event) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return applicationStreamResponse(
    request,
    { eventId: event.id },
    authorized.deadline,
  );
}
