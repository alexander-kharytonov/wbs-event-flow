import { buildBadgePresentation } from "@/features/badges/server/badges";
import { badgeHtmlResponse } from "@/features/badges/server/print-html";
import { requireVerifiedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; attendeeId: string }> },
) {
  const selector = await params;
  const user = await requireVerifiedUser();
  const result = await buildBadgePresentation({ userId: user.id }, selector, {
    mode: "PRINT",
  });

  if (!result) {
    return badgeHtmlResponse(
      { error: "This print document is unavailable. Please open it again." },
      selector.eventId,
      404,
    );
  }

  return badgeHtmlResponse(
    { presentations: [result.presentation], nextCursor: null },
    selector.eventId,
  );
}
