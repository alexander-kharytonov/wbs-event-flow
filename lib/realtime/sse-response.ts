import "server-only";
import {
  type ApplicationSubscription,
  getApplicationBroker,
} from "@/lib/realtime/application-broker";

export function applicationStreamResponse(
  request: Request,
  scope: ApplicationSubscription,
  deadline: number,
) {
  if (Date.now() >= deadline) {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let closed = false;
        let unsubscribe = () => {};
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let lifetime: ReturnType<typeof setTimeout> | undefined;
        cleanup = () => {
          if (closed) {
            return;
          }

          closed = true;
          unsubscribe();
          clearInterval(heartbeat);
          clearTimeout(lifetime);
          request.signal.removeEventListener("abort", cleanup);

          try {
            controller.close();
          } catch {
            // Cancellation may already have closed the controller.
          }
        };
        const send = (frame: string) => {
          if (closed) {
            return;
          }

          if (Date.now() >= deadline || (controller.desiredSize ?? 0) <= 0) {
            cleanup();

            return;
          }

          try {
            controller.enqueue(encoder.encode(frame));
          } catch {
            cleanup();
          }
        };
        request.signal.addEventListener("abort", cleanup, { once: true });

        if (request.signal.aborted) {
          cleanup();

          return;
        }

        heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);
        lifetime = setTimeout(cleanup, Math.max(0, deadline - Date.now()));
        send("retry: 3000\n\n");

        if (!closed) {
          unsubscribe = getApplicationBroker().subscribe(scope, {
            send: (event) => send(`event: ${event}\ndata: {}\n\n`),
            close: cleanup,
          });
        }

        if (closed) {
          unsubscribe();
        }
      },
      cancel() {
        cleanup();
      },
    },
    { highWaterMark: 1024, size: (chunk) => chunk.byteLength },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
