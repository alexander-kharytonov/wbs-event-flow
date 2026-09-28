import { applicationStreamResponse } from "@/lib/realtime/sse-response";
import { getStreamSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorized = await getStreamSession(request);

  if (authorized instanceof Response) {
    return authorized;
  }

  return applicationStreamResponse(
    request,
    { userId: authorized.userId },
    authorized.deadline,
  );
}
