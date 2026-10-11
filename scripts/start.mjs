import { createServer } from "node:http";
import next from "next";

process.env.NODE_ENV = "production";
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT");
}

let stopping = false;
let ready = false;
let handle;
const server = createServer((request, response) => {
  if (stopping || (!ready && request.url !== "/api/health")) {
    response.writeHead(503, {
      Connection: "close",
      "Cache-Control": "no-store",
    });
    response.end();

    return;
  }

  void handle(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
const app = next({ dev: false, hostname: "0.0.0.0", port, httpServer: server });

async function shutdown() {
  if (stopping) {
    return;
  }

  stopping = true;
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    console.error("Shutdown deadline reached; durable leases will recover.");
    process.exit(1);
  }, 60_000);

  try {
    const requestsDone = new Promise((resolve) => server.close(resolve));
    await Promise.all([requestsDone, globalThis.eventFlowDrain?.()]);
    await app.close();
    await globalThis.eventFlowDisconnect?.();
    clearTimeout(deadline);
    process.exit(0);
  } catch {
    console.error("Shutdown failed; durable leases will recover.");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

try {
  await app.prepare();

  handle = app.getRequestHandler();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  // This Next.js version initializes instrumentation on its first request.
  const health = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(15_000),
  });
  await health.body?.cancel();

  if (
    !health.ok ||
    !globalThis.eventFlowDrain ||
    !globalThis.eventFlowDisconnect
  ) {
    throw new Error("Runtime cleanup was not registered");
  }

  ready = true;
  console.log("Event Flow server ready.");
} catch {
  console.error(
    "Startup failed. Check server configuration and media permissions.",
  );
  process.exit(1);
}
