import { discardTemporaryCover } from "@/features/events/server/media-assets";
import {
  mediaActor,
  mediaFailure,
  mediaHeaders,
  requireMediaId,
} from "@/features/events/server/media-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await context.params;
    requireMediaId(assetId);
    const userId = await mediaActor(request, true);
    await discardTemporaryCover(userId, assetId);

    return new Response(null, { status: 204, headers: mediaHeaders });
  } catch (error) {
    return mediaFailure(error);
  }
}
