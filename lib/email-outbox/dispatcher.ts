import "server-only";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  claimEmailBatch,
  deliverClaimedEmail,
} from "@/lib/email-outbox/delivery";
import { emailOutboxChannel } from "@/lib/email-outbox/enqueue";
import { getServerEnv } from "@/lib/env";

class EmailOutboxDispatcher {
  private readonly workerId = randomUUID();
  private client?: Client;
  private ready = false;
  private disposed = false;
  private connectPromise?: Promise<void>;
  private closing?: Promise<void>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private sweepTimer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private requested = false;
  private retryDelay = 500;

  constructor() {
    this.sweepTimer = setInterval(() => this.wake(), 30_000);
    this.sweepTimer.unref();
    this.ensureConnected();
    this.wake();
  }

  wake() {
    if (this.disposed) {
      return;
    }

    this.requested = true;

    if (this.running) {
      return;
    }

    this.running = this.sweep()
      .catch(() => {
        // No recipient, payload, SMTP response, or SQL arguments in logs.
        console.error("Email outbox sweep failed; a later sweep will retry.");
      })
      .finally(() => {
        this.running = undefined;

        if (this.requested && !this.disposed) {
          this.wake();
        }
      });
  }

  private async sweep() {
    do {
      this.requested = false;
      const rows = await claimEmailBatch(this.workerId);
      // All five start together: queueing within the batch cannot age a lease.
      const outcomes = await Promise.allSettled(
        rows
          .filter((row) => row.status === "PROCESSING")
          .map((row) => deliverClaimedEmail(row, this.workerId)),
      );

      if (outcomes.some((outcome) => outcome.status === "rejected")) {
        console.error(
          "Email outbox completion failed; lease recovery will retry.",
        );
      }

      if (rows.length > 0) {
        this.requested = true;
      }
    } while (this.requested && !this.disposed);
  }

  private ensureConnected() {
    if (
      this.disposed ||
      this.ready ||
      this.connectPromise ||
      this.closing ||
      this.reconnectTimer
    ) {
      return;
    }

    this.connectPromise = this.connect().finally(() => {
      this.connectPromise = undefined;
      this.scheduleReconnect();
    });
  }

  private async connect() {
    const client = new Client({
      connectionString: getServerEnv().DATABASE_URL,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      application_name: "event-flow-email-outbox-listener",
    });
    this.client = client;
    client.on("error", () => this.connectionLost(client));
    client.on("end", () => this.connectionLost(client));
    client.on("notification", (message) => {
      if (
        this.ready &&
        this.client === client &&
        message.channel === emailOutboxChannel
      ) {
        this.wake();
      }
    });

    try {
      await client.connect();
      // Fixed server-owned channel, distinct from application SSE.
      await client.query(`LISTEN ${emailOutboxChannel}`);

      if (this.disposed || this.client !== client) {
        return;
      }

      this.ready = true;
      this.retryDelay = 500;
      this.wake();
    } catch {
      this.connectionLost(client);
    }
  }

  private connectionLost(client: Client) {
    if (this.client !== client) {
      return;
    }

    this.ready = false;
    this.client = undefined;
    this.closing = client
      .end()
      .catch(() => {})
      .finally(() => {
        this.closing = undefined;
        this.scheduleReconnect();
      });
  }

  private scheduleReconnect() {
    if (
      this.disposed ||
      this.ready ||
      this.connectPromise ||
      this.closing ||
      this.reconnectTimer
    ) {
      return;
    }

    const delay = this.retryDelay + Math.floor(Math.random() * 250);
    this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.ensureConnected();
    }, delay);
    this.reconnectTimer.unref();
  }

  async dispose() {
    this.disposed = true;
    this.ready = false;
    clearInterval(this.sweepTimer);
    clearTimeout(this.reconnectTimer);
    const client = this.client;
    this.client = undefined;
    await client?.end().catch(() => {});
    await this.closing;
    await this.connectPromise;
    await this.running;
  }
}

const globalForOutbox = globalThis as unknown as {
  eventFlowEmailOutboxDispatcher?: EmailOutboxDispatcher;
};

export function startEmailOutboxDispatcher() {
  globalForOutbox.eventFlowEmailOutboxDispatcher ??=
    new EmailOutboxDispatcher();

  return globalForOutbox.eventFlowEmailOutboxDispatcher;
}

export async function stopEmailOutboxDispatcher() {
  const dispatcher = globalForOutbox.eventFlowEmailOutboxDispatcher;
  await dispatcher?.dispose();

  if (globalForOutbox.eventFlowEmailOutboxDispatcher === dispatcher) {
    globalForOutbox.eventFlowEmailOutboxDispatcher = undefined;
  }
}
