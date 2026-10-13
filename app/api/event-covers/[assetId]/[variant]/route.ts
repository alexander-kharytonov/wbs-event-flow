import {
  mediaFailure,
  serveEventMedia,
} from "@/features/events/server/media-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string; variant: string }> },
) {
  try {
    return await serveEventMedia(request, {
      ...(await context.params),
      temporary: true,
    });
  } catch (error) {
    return mediaFailure(error);
  }
}
