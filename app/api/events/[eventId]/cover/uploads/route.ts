import { uploadEventCover } from "@/features/events/server/media-assets";
import {
  mediaActor,
  mediaFailure,
  mediaHeaders,
  requireMediaId,
} from "@/features/events/server/media-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await context.params;
    requireMediaId(eventId);
    const userId = await mediaActor(request, true);
    const result = await uploadEventCover(userId, eventId, request);

    return Response.json(result, { status: 201, headers: mediaHeaders });
  } catch (error) {
    return mediaFailure(error);
  }
}
