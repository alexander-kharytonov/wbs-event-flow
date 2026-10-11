import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { renderToReadableStream } from "react-dom/server.edge";
import { badgeLabels } from "@/features/badges/components/badge";
import { BadgePrintPages } from "@/features/badges/components/print-pages";
import { nextBadgeBatchUrl } from "@/features/badges/print-request";
import type { BulkBadgeResult } from "@/features/badges/server/bulk";
import type { Messages } from "@/lib/i18n/messages";

export const badgePrintHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function badgeHtmlResponse(
  result: BulkBadgeResult,
  eventId: string,
  status = 200,
) {
  const t = await getTranslations("events");
  const locale = await getLocale();
  const stream = await renderToReadableStream(
    <html lang={locale}>
      {/* biome-ignore lint/style/noHeadElement: standalone Route Handler HTML, not a Next page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="referrer" content="no-referrer" />
        <title>{t("printBadges")} | Event Flow</title>
      </head>
      <body>
        <main className="ef-print-document" data-badge-document>
          <div className="ef-print-controls">
            <h1>{t("printBadges")}</h1>
            {"error" in result ? (
              <p role="alert">{t(result.error as keyof Messages["events"])}</p>
            ) : (
              <>
                <p>
                  {t("printBadgeInstructions", {
                    count: result.presentations.length,
                  })}
                </p>
                <button id="print-badges" type="button">
                  {t("printAction")}{" "}
                </button>
                <p id="print-error" role="alert" hidden>
                  {t("printImagesFailed")}{" "}
                </p>
                {result.nextCursor && (
                  <>
                    <p>{t("printMoreHint")} </p>
                    <a
                      href={nextBadgeBatchUrl(eventId, result.nextCursor)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("printNext")}{" "}
                    </a>
                  </>
                )}
              </>
            )}
            <a
              href={`/dashboard/events/${eventId}/badges`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("printRefresh")}{" "}
            </a>
          </div>
          {!("error" in result) && (
            <BadgePrintPages
              badges={result.presentations}
              labels={badgeLabels(t)}
            />
          )}
        </main>
        {!("error" in result) && <script src="/badge-print.js" defer />}
      </body>
    </html>,
    { onError: () => undefined },
  );
  // Buffer before committing a response: a rendering failure never sends partial credentials.
  await stream.allReady;
  const html = await new Response(stream).text();

  return new Response(html, { status, headers: badgePrintHeaders });
}
