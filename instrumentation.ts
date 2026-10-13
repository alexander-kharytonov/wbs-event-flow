export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startEmailOutboxDispatcher, stopEmailOutboxDispatcher } =
      await import("@/lib/email-outbox/dispatcher");
    const { stopApplicationBroker } = await import(
      "@/lib/realtime/application-broker"
    );
    const { startTemporaryMediaCleanup, stopTemporaryMediaCleanup } =
      await import("@/features/events/server/media-cleanup");
    const { prisma } = await import("@/lib/prisma");
    const { getServerEnv } = await import("@/lib/env");
    const { mediaStorage } = await import("@/lib/media-storage");

    if (process.env.NODE_ENV === "production") {
      await mediaStorage().validate();
    }

    if (getServerEnv().EMAIL_OUTBOX_ENABLED === "true") {
      startEmailOutboxDispatcher();
    }

    startTemporaryMediaCleanup();

    const runtime = globalThis as unknown as {
      eventFlowDrain?: () => Promise<void>;
      eventFlowDisconnect?: () => Promise<void>;
    };
    runtime.eventFlowDrain = async () => {
      await Promise.all([
        stopEmailOutboxDispatcher(),
        stopApplicationBroker(),
        stopTemporaryMediaCleanup(),
      ]);
    };
    runtime.eventFlowDisconnect = () => prisma.$disconnect();
  }
}
