import { attachEventCover } from "@/features/events/server/media-assets";
import {
  mediaActor,
  mediaFailure,
  mediaHeaders,
  requireMediaId,
} from "@/features/events/server/media-http";
import { MediaError, readUpload } from "@/features/events/server/media-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await context.params;
    requireMediaId(eventId);
    const userId = await mediaActor(request, true);

    if (request.headers.get("content-type") !== "application/json") {
      throw new MediaError(415, "Send JSON cover settings.");
    }

    let input: unknown;

    try {
      input = JSON.parse((await readUpload(request, 4096)).toString("utf8"));
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }

      throw new MediaError(400, "Invalid cover settings.");
    }

    const result = await attachEventCover(userId, eventId, input);

    return Response.json(result, { headers: mediaHeaders });
  } catch (error) {
    return mediaFailure(error);
  }
}
