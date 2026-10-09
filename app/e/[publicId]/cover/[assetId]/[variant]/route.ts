import {
  mediaFailure,
  serveEventMedia,
} from "@/features/events/server/media-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ publicId: string; assetId: string; variant: string }>;
  },
) {
  try {
    return await serveEventMedia(request, await context.params);
  } catch (error) {
    return mediaFailure(error);
  }
}
