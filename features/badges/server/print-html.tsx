import "server-only";
import { renderToReadableStream } from "react-dom/server.edge";
import { BadgePrintPages } from "@/features/badges/components/print-pages";
import { nextBadgeBatchUrl } from "@/features/badges/print-request";
import type { BulkBadgeResult } from "@/features/badges/server/bulk";

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
  const stream = await renderToReadableStream(
    <html lang="en">
      {/* biome-ignore lint/style/noHeadElement: standalone Route Handler HTML, not a Next page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="referrer" content="no-referrer" />
        <title>Print badges | Event Flow</title>
      </head>
      <body>
        <main className="ef-print-document" data-badge-document>
          <div className="ef-print-controls">
            <h1>Print badges</h1>
            {"error" in result ? (
              <p role="alert">{result.error}</p>
            ) : (
              <>
                <p>
                  {result.presentations.length} badges. One badge per physical
                  page. This document uses the saved design and admission state
                  from when it was opened. Check paper size and scaling in the
                  print dialog.
                </p>
                <button id="print-badges" type="button">
                  Print
                </button>
                <p id="print-error" role="alert" hidden>
                  Could not prepare the images. Please open the document again.
                </p>
                {result.nextCursor && (
                  <>
                    <p>
                      More active attendees are available. Each next batch uses
                      current data; the active set may change.
                    </p>
                    <a
                      href={nextBadgeBatchUrl(eventId, result.nextCursor)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Print next batch
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
              Refresh workspace
            </a>
          </div>
          {!("error" in result) && (
            <BadgePrintPages badges={result.presentations} />
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
