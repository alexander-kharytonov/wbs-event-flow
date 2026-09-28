import "server-only";
import { Client } from "pg";
import { getServerEnv } from "@/lib/env";
import {
  applicationNotificationChannel,
  parseApplicationNotification,
} from "@/lib/realtime/application-notifications";

export type ApplicationSubscription = { eventId: string } | { userId: string };

type Subscriber = {
  send: (event: "connected" | "invalidate") => void;
  close: () => void;
};

class ApplicationBroker {
  private client?: Client;
  private ready = false;
  private disposed = false;
  private connectPromise?: Promise<void>;
  private closing?: Promise<void>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private retryDelay = 500;
  private events = new Map<string, Set<Subscriber>>();
  private users = new Map<string, Set<Subscriber>>();

  subscribe(scope: ApplicationSubscription, subscriber: Subscriber) {
    if (this.disposed) {
      subscriber.close();

      return () => {};
    }

    const map = "eventId" in scope ? this.events : this.users;
    const key = "eventId" in scope ? scope.eventId : scope.userId;
    const subscribers = map.get(key) ?? new Set<Subscriber>();
    subscribers.add(subscriber);
    map.set(key, subscribers);

    if (this.ready) {
      this.deliver(new Set([subscriber]), "connected");
    } else {
      this.ensureConnected();
    }

    return () => {
      subscribers.delete(subscriber);

      if (subscribers.size === 0) {
        map.delete(key);
      }
    };
  }

  private deliver(
    subscribers: Set<Subscriber>,
    event: "connected" | "invalidate",
  ) {
    for (const subscriber of [...subscribers]) {
      try {
        subscriber.send(event);
      } catch {
        subscribers.delete(subscriber);

        try {
          subscriber.close();
        } catch {
          // A broken stream must not stop delivery to other subscribers.
        }
      }
    }
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
      application_name: "event-flow-application-listener",
    });
    this.client = client;
    client.on("error", () => this.connectionLost(client));
    client.on("end", () => this.connectionLost(client));
    client.on("notification", (message) => {
      if (
        !this.ready ||
        this.client !== client ||
        message.channel !== applicationNotificationChannel
      ) {
        return;
      }

      const notification = parseApplicationNotification(message.payload);

      if (!notification) {
        return;
      }

      const organizers = this.events.get(notification.eventId);
      const attendees = notification.userId
        ? this.users.get(notification.userId)
        : undefined;

      if (organizers) {
        this.deliver(organizers, "invalidate");
      }

      if (attendees) {
        this.deliver(attendees, "invalidate");
      }
    });

    try {
      await client.connect();
      // The channel is a server-owned constant, never a request identifier.
      await client.query(`LISTEN ${applicationNotificationChannel}`);

      if (this.disposed || this.client !== client) {
        return;
      }

      this.ready = true;
      this.retryDelay = 500;

      for (const subscribers of [
        ...this.events.values(),
        ...this.users.values(),
      ]) {
        this.deliver(subscribers, "connected");
      }
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
    this.retryDelay = Math.min(this.retryDelay * 2, 10000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.ensureConnected();
    }, delay);
    this.reconnectTimer.unref();
  }

  async dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.ready = false;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;

    for (const subscribers of [
      ...this.events.values(),
      ...this.users.values(),
    ]) {
      for (const subscriber of [...subscribers]) {
        try {
          subscriber.close();
        } catch {
          // Continue closing the other streams.
        }
      }
    }

    this.events.clear();
    this.users.clear();
    const client = this.client;
    this.client = undefined;
    await client?.end().catch(() => {});
    await this.closing;
    await this.connectPromise;
  }
}

const globalForRealtime = globalThis as unknown as {
  eventFlowApplicationBroker?: ApplicationBroker;
};

export function getApplicationBroker() {
  globalForRealtime.eventFlowApplicationBroker ??= new ApplicationBroker();

  return globalForRealtime.eventFlowApplicationBroker;
}
