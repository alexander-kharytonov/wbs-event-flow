// Targeted 27D verification. Disposable isolated DB; no server, dispatcher or SMTP.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import type { Prisma } from "@/generated/prisma/client";

type VerificationFailure = { error: unknown } | undefined;

async function finishVerification(
  failure: VerificationFailure,
  cleanups: (() => unknown | Promise<unknown>)[],
  reportCleanupErrors = (errors: unknown[]) =>
    console.error("Verification cleanup also failed:", errors),
) {
  const errors: unknown[] = [];

  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  }

  if (failure) {
    if (errors.length > 0) {
      reportCleanupErrors(errors);
    }

    throw failure.error;
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, "Verification cleanup failed.");
  }
}

async function verifyHeldClaim({
  claim,
  started,
  verify,
  release,
  restore,
}: {
  claim: () => Promise<unknown>;
  started: Promise<void>;
  verify: () => Promise<void>;
  release: () => void;
  restore: () => void;
}) {
  // Install both handlers immediately, including for a synchronous claim throw.
  const outcome = Promise.resolve()
    .then(claim)
    .then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );
  let failure: VerificationFailure;

  try {
    await Promise.race([
      started,
      outcome.then((result) => {
        if (!result.ok) {
          throw result.error;
        }

        throw new Error("Claim completed without the ready signal.");
      }),
    ]);
    await verify();
  } catch (error) {
    failure = { error };
  } finally {
    try {
      release();
      const result = await outcome;

      if (!result.ok) {
        failure ??= { error: result.error };
      }
    } finally {
      restore();
    }
  }

  if (failure) {
    throw failure.error;
  }
}

async function checkFailurePaths() {
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);

  try {
    for (const mode of [
      "normal",
      "before-ready",
      "after-ready",
      "commit",
      "verify",
    ] as const) {
      let ready = () => {};
      let release = () => {};
      const started = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const original = () => {};
      const patched = () => {};
      const client = { $transaction: patched };
      const expected = new Error(mode);
      let released = false;
      let cleaned = false;
      let failure: VerificationFailure;

      try {
        await verifyHeldClaim({
          claim: async () => {
            if (mode === "before-ready") {
              throw expected;
            }
            ready();

            if (mode === "after-ready") {
              throw expected;
            }
            await hold;

            if (mode === "commit") {
              throw expected;
            }

            if (mode === "verify") {
              throw new Error("Secondary commit failure");
            }
          },
          started,
          verify: async () => {
            await delay(0);

            if (mode === "verify") {
              throw expected;
            }
          },
          release: () => {
            released = true;
            release();
          },
          restore: () => {
            client.$transaction = original;
          },
        });
      } catch (error) {
        failure = { error };
      } finally {
        const cleanup = finishVerification(failure, [
          () => {
            cleaned = true;
          },
        ]);

        if (mode === "normal") {
          await cleanup;
        } else {
          await assert.rejects(cleanup, (error) => error === expected);
        }
      }
      assert.equal(released, true);
      assert.equal(client.$transaction, original);
      assert.equal(cleaned, true);
    }

    for (const failedStep of [0, 1, 2]) {
      const attempts: number[] = [];
      const cleanupError = new Error("Simulated cleanup failure");
      await assert.rejects(
        finishVerification(
          undefined,
          [0, 1, 2].map((step) => () => {
            attempts.push(step);

            if (step === failedStep) {
              throw cleanupError;
            }
          }),
        ),
        (error) =>
          error instanceof AggregateError && error.errors[0] === cleanupError,
      );
      assert.deepEqual(attempts, [0, 1, 2]);
    }
    const primary = new Error("Primary claim failure");
    const cleanupError = new Error("Secondary drop failure");
    const reported: unknown[][] = [];
    let finalCleanup = false;
    await assert.rejects(
      finishVerification(
        { error: primary },
        [
          () => {
            throw cleanupError;
          },
          () => {
            finalCleanup = true;
          },
        ],
        (errors) => {
          reported.push(errors);
        },
      ),
      (error) => error === primary,
    );
    assert.equal(finalCleanup, true);
    assert.deepEqual(reported, [[cleanupError]]);
    await delay(0);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  console.log(
    "PASS: normal/before-ready/after-ready/commit failures, release, restoration, original error and all cleanup steps",
  );
}

async function checkSummaries() {
  const { communicationDeliverySummary } = await import(
    "@/features/communications/delivery-status"
  );

  for (let pending = 0; pending <= 4; pending++) {
    for (let processing = 0; processing <= 4; processing++) {
      for (let sent = 0; sent <= 4; sent++) {
        for (let failed = 0; failed <= 4; failed++) {
          const count = pending + processing + sent + failed;
          const expected =
            count === 0
              ? "No recipients"
              : pending === count
                ? "Pending"
                : sent === count
                  ? "Sent"
                  : failed === count
                    ? "Failed"
                    : failed > 0
                      ? pending + processing > 0
                        ? "In progress · partial failures"
                        : "Completed with failures"
                      : "In progress";
          assert.equal(
            communicationDeliverySummary(count, {
              PENDING: pending,
              PROCESSING: processing,
              SENT: sent,
              FAILED: failed,
            }).label,
            expected,
          );
        }
      }
    }
  }

  for (const [recipientCount, counts] of [
    [1, [0, 0, 1, 1]],
    [0, [1, 0, 0, 0]],
    [1, [0, 0, 0, 0]],
    [1, [-1, 0, 2, 0]],
    [1, [0.5, 0, 0.5, 0]],
    [1, [Number.NaN, 0, 1, 0]],
    [1, [0, 0, Number.POSITIVE_INFINITY, 0]],
    [-1, [0, 0, 0, 0]],
    [0.5, [0, 0, 0, 0]],
  ] as const) {
    assert.deepEqual(
      communicationDeliverySummary(recipientCount, {
        PENDING: counts[0],
        PROCESSING: counts[1],
        SENT: counts[2],
        FAILED: counts[3],
      }),
      { label: "Status unavailable", color: "default" },
    );
  }
  console.log(
    "PASS: 625 valid summary combinations; inconsistent, missing, negative and fractional counts are neutral",
  );
}

async function checkInvalidationConcurrency() {
  const { prisma } = await import("@/lib/prisma");
  const { finishEmailDelivery } = await import("@/lib/email-outbox/delivery");
  const originalQuery = prisma.$queryRaw;
  const originalTransaction = prisma.$transaction;
  const eventId = randomUUID();

  for (const failFirst of [false, true]) {
    const ids = Array.from({ length: 120 }, () => randomUUID());
    // Same Communication changes while its earlier invalidation is in flight.
    ids[1] = ids[0];
    const batches: string[][] = [];
    const notifications: unknown[] = [];
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let done = () => {};
    const drained = new Promise<void>((resolve) => {
      done = resolve;
    });
    let query = 0;
    let transactions = 0;
    let active = 0;
    let maximumActive = 0;
    prisma.$queryRaw = (() =>
      Promise.resolve([
        { communicationId: ids[query++] },
      ])) as typeof prisma.$queryRaw;
    prisma.$transaction = (async (
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      const index = transactions++;
      active++;
      maximumActive = Math.max(maximumActive, active);

      try {
        if (index === 0) {
          await hold;
        }

        if (index === 0 && failFirst) {
          throw new Error("Simulated slow notification failure");
        }

        return await callback({
          $executeRaw: async (
            _strings: TemplateStringsArray,
            ...values: unknown[]
          ) => {
            if (values.length === 2) {
              notifications.push(JSON.parse(values[1] as string));
            }

            return 0;
          },
          communication: {
            findMany: async (args: { where: { id: { in: string[] } } }) => {
              batches.push(args.where.id.in);

              return args.where.id.in.map(() => ({ eventId }));
            },
          },
        } as unknown as Prisma.TransactionClient);
      } finally {
        active--;

        if (index === 1) {
          done();
        }
      }
    }) as typeof prisma.$transaction;

    try {
      // Only the status-result/notification seam is mocked; production
      // coalescing runs unchanged. No database mutation and no SMTP here.
      const results = await Promise.all(
        ids.map((id) =>
          finishEmailDelivery({ id, attempts: 1 }, "verification", null),
        ),
      );
      assert.ok(results.every((result) => result === 1));
      assert.equal(transactions, 1); // completion never waits for notification
      release();
      await drained;
      await delay(0);
      assert.equal(maximumActive, 1);
      assert.equal(active, 0);
      assert.equal(transactions, 2);
      assert.deepEqual(
        batches.map((batch) => batch.length),
        failFirst ? [50] : [1, 50],
      );
      assert.equal(batches.at(-1)?.[0], ids[0]);
      assert.equal(notifications.length, failFirst ? 1 : 2);
      assert.ok(
        notifications.every(
          (notice) =>
            JSON.stringify(notice) ===
            JSON.stringify({ type: "event.changed", eventId, userId: null }),
        ),
      );
    } finally {
      release();
      try {
        // Drain any already started detached callback before restoring stubs.
        await delay(0);
      } finally {
        prisma.$queryRaw = originalQuery;
        prisma.$transaction = originalTransaction;
      }
    }
  }
  console.log(
    "PASS: 120 completion burst, one active notification, 50 pending IDs, same-Event coalescing, changes during flush, bounded overflow and failure recovery",
  );
}

async function main() {
  await checkFailurePaths();
  await checkSummaries();

  if (process.argv.includes("--preflight-only")) {
    return;
  }

  loadEnvConfig(process.cwd(), true);
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl);
  const databaseName = `event_flow_verify_27d_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: originalUrl });
  let connection: Client | undefined;
  let db: typeof import("@/lib/prisma")["prisma"] | undefined;
  let created = false;
  let failure: VerificationFailure;

  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
    created = true;
    const isolatedUrl = new URL(originalUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = isolatedUrl.toString();
    connection = new Client({ connectionString: process.env.DATABASE_URL });
    await connection.connect();
    assert.equal(
      (await connection.query("SELECT current_database() AS name")).rows[0]
        .name,
      databaseName,
    );
    const migrations = (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migration of migrations) {
      await connection.query(
        await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    }

    const { prisma } = await import("@/lib/prisma");
    db = prisma;
    assert.equal(
      (
        await prisma.$queryRaw<
          { name: string }[]
        >`SELECT current_database() AS name`
      )[0].name,
      databaseName,
    );
    const { queryCommunicationHistory } = await import(
      "@/features/communications/server/read-history"
    );
    const { queryCommunicationDetails } = await import(
      "@/features/communications/server/read-details"
    );
    const { communicationDeliverySummary } = await import(
      "@/features/communications/delivery-status"
    );
    const { projectCommunicationContext } = await import(
      "@/features/communications/server/history"
    );
    const { claimEmailBatch, finishEmailDelivery } = await import(
      "@/lib/email-outbox/delivery"
    );
    const { parseApplicationNotification, applicationNotificationChannel } =
      await import("@/lib/realtime/application-notifications");
    const [owner, manager, reception, foreign] = await Promise.all(
      ["owner", "manager", "reception", "foreign"].map((name) =>
        prisma.user.create({
          data: { name, email: `${name}@example.test`, emailVerified: true },
        }),
      ),
    );
    const organizer = await prisma.organizerProfile.create({
      data: { userId: owner.id },
    });
    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: "Current event title",
        timezone: "UTC",
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-01-02"),
      },
    });
    const other = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: "Other event",
        timezone: "UTC",
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-01-02"),
      },
    });
    await prisma.eventStaff.createMany({
      data: [
        { eventId: event.id, userId: manager.id, role: "MANAGER" },
        { eventId: event.id, userId: reception.id, role: "RECEPTION" },
      ],
    });
    const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED"] as const;
    const future = new Date("2099-01-01");
    const frozenAt = new Date("2026-01-01");
    async function communication(
      count: number,
      manual = false,
      eventId = event.id,
    ) {
      return prisma.communication.create({
        data: {
          eventId,
          kind: manual ? "MANUAL" : "TRANSACTIONAL",
          trigger: manual ? null : "EVENT_CANCELLED",
          audience: manual ? "EVENT_STAFF" : null,
          actorUserId: manual ? manager.id : null,
          actorNameSnapshot: manual ? "Frozen manager" : null,
          actorRoleSnapshot: manual ? "MANAGER" : null,
          subject: "Frozen subject",
          message: manual ? "Line one\n<script>safe text</script>" : null,
          contextSnapshot: manual
            ? {
                schemaVersion: 1,
                kind: "MANUAL",
                eventTitle: "Frozen event title",
              }
            : {
                schemaVersion: 1,
                kind: "TRANSACTIONAL",
                trigger: "EVENT_CANCELLED",
                eventTitle: "Frozen event title",
              },
          recipientCount: count,
          idempotencyKey: randomUUID(),
          requestDigest: manual ? "a".repeat(64) : null,
          createdAt: frozenAt,
          deliveries: {
            createMany: {
              data: Array.from({ length: count }, (_, i) => ({
                recipientEmail: `recipient${String(i).padStart(4, "0")}@example.test`,
                type: manual ? "MANUAL_EVENT_MESSAGE" : "EVENT_CANCELLED",
                status: statuses[i % 4],
                attempts: i % 4,
                nextAttemptAt: future,
                lockedAt: future,
                sentAt: i % 4 === 2 ? frozenAt : null,
                deduplicationKey: randomUUID(),
                payload: { secret: "NEVER_EXPOSE_PAYLOAD" },
                lastError: "NEVER_EXPOSE_SMTP",
                lockedBy: "NEVER_EXPOSE_LEASE",
              })),
            },
          },
        },
      });
    }
    const fixtures: Awaited<ReturnType<typeof communication>>[] = [];

    for (const count of [0, 1, 50, 51, 1000]) {
      fixtures.push(await communication(count, count === 51));
    }
    const manual = fixtures[3];
    const foreignCommunication = await communication(1, false, other.id);

    for (let i = 0; i < 21; i++) {
      await communication(0);
    }
    const history = (userId = owner.id, before?: string, eventId = event.id) =>
      prisma.$transaction(
        (tx) => queryCommunicationHistory(tx, eventId, userId, before),
        { isolationLevel: "RepeatableRead" },
      );
    const details = (
      communicationId: string,
      after?: string,
      userId = owner.id,
      eventId = event.id,
    ) =>
      prisma.$transaction(
        (tx) =>
          queryCommunicationDetails(
            tx,
            eventId,
            userId,
            communicationId,
            after,
          ),
        { isolationLevel: "RepeatableRead" },
      );
    const firstHistory = await history();
    assert.ok(firstHistory);
    assert.equal(firstHistory.items.length, 20);
    const secondHistory = await history(owner.id, firstHistory.nextCursor);
    assert.ok(secondHistory);
    assert.equal(secondHistory.items.length, 6);
    const allHistory = [...firstHistory.items, ...secondHistory.items];
    assert.equal(new Set(allHistory.map((item) => item.id)).size, 26);
    assert.deepEqual(
      allHistory.map((item) => item.id),
      allHistory
        .map((item) => item.id)
        .sort()
        .reverse(),
    );
    assert.ok(allHistory.some((item) => item.kind === "MANUAL"));
    assert.ok(allHistory.some((item) => item.kind === "TRANSACTIONAL"));
    assert.equal(JSON.stringify(allHistory).includes("@example.test"), false);
    assert.equal(JSON.stringify(allHistory).includes("NEVER_EXPOSE"), false);
    assert.equal("message" in allHistory[0], false);
    assert.ok(await history(manager.id));
    assert.ok(await details(manual.id, undefined, manager.id));

    for (const actor of [reception, foreign]) {
      assert.equal(await history(actor.id), null);
      assert.equal(await details(manual.id, undefined, actor.id), null);
    }
    assert.equal(await details(foreignCommunication.id), null);
    assert.equal(await details("invalid"), null);
    assert.equal(await details(randomUUID()), null);
    const foreignRecipient = await prisma.emailOutbox.findFirstOrThrow({
      where: { communicationId: foreignCommunication.id },
    });

    for (const cursor of ["invalid", "", randomUUID(), foreignRecipient.id]) {
      assert.equal(await details(manual.id, cursor), null);
    }
    assert.equal(await history(owner.id, foreignCommunication.id), null);
    assert.equal(await history(owner.id, "invalid"), null);
    console.log(
      "PASS: unified history, tied-time ordering, 20-record keyset, scope/RBAC and invalid cursors",
    );

    for (const fixture of fixtures) {
      const ids: string[] = [];
      let after: string | undefined;
      let pages = 0;

      do {
        const page = await details(fixture.id, after);
        assert.ok(page);
        assert.ok(page.recipients.length <= 50);
        assert.equal(page.communication.recipientCount, fixture.recipientCount);
        assert.equal(JSON.stringify(page).includes("NEVER_EXPOSE"), false);

        for (const row of page.recipients) {
          assert.deepEqual(Object.keys(row).sort(), [
            "attempts",
            "createdAt",
            "id",
            "recipientEmail",
            "sentAt",
            "status",
          ]);
        }
        ids.push(...page.recipients.map((row) => row.id));
        after = page.nextCursor;
        pages++;

        if (after) {
          // Moving a row's live status cannot move its frozen pagination position.
          await prisma.emailOutbox.update({
            where: { id: after },
            data: { status: "FAILED" },
          });
        }
      } while (after);
      assert.equal(ids.length, fixture.recipientCount);
      assert.equal(new Set(ids).size, fixture.recipientCount);
      assert.equal(pages, Math.max(1, Math.ceil(fixture.recipientCount / 50)));
      const expected = await prisma.emailOutbox.findMany({
        where: { communicationId: fixture.id },
        select: { id: true },
        orderBy: { recipientEmail: "asc" },
      });
      assert.deepEqual(
        ids,
        expected.map((row) => row.id),
      );
    }
    const safeManual = await details(manual.id);
    assert.equal(
      safeManual?.communication.message,
      "Line one\n<script>safe text</script>",
    );
    assert.equal(
      safeManual?.communication.context.eventTitle,
      "Frozen event title",
    );
    const safeTransactional = await details(fixtures[1].id);
    assert.equal(safeTransactional?.communication.message, null);
    assert.deepEqual(
      Object.keys(safeTransactional?.communication.context ?? {}).sort(),
      ["eventTitle", "kind", "schemaVersion", "trigger"],
    );
    assert.throws(() =>
      projectCommunicationContext({
        schemaVersion: 1,
        kind: "TRANSACTIONAL",
        trigger: "EVENT_CANCELLED",
        ticketUrl: "secret",
      }),
    );
    await prisma.eventStaff.delete({
      where: { eventId_userId: { eventId: event.id, userId: manager.id } },
    });
    assert.equal(await details(manual.id, undefined, manager.id), null);
    await prisma.user.delete({ where: { id: manager.id } });
    const historical = await details(manual.id);
    assert.equal(historical?.communication.actorNameSnapshot, "Frozen manager");
    assert.equal(historical?.communication.actorRoleSnapshot, "MANAGER");
    assert.equal("actorUserId" in (historical?.communication ?? {}), false);
    console.log(
      "PASS: 0/1/50/51/1000 recipients, no skips/duplicates across live status changes, safe frozen content and deleted actor",
    );

    // Exercise the production reader with an instrumented transaction: only one
    // recipient query, bounded at 51, with no raw delivery fields selected.
    await prisma.$transaction(async (tx) => {
      let recipientQueries = 0;
      const observed = new Proxy(tx, {
        get(target, key) {
          if (key === "emailOutbox") {
            return new Proxy(tx.emailOutbox, {
              get(model, method) {
                if (method === "findMany") {
                  return async (args: Parameters<typeof model.findMany>[0]) => {
                    recipientQueries++;
                    assert.equal(args?.take, 51);
                    assert.equal(
                      args?.select && "payload" in args.select,
                      false,
                    );

                    return model.findMany(args);
                  };
                }

                return Reflect.get(model, method);
              },
            });
          }

          return Reflect.get(target, key);
        },
      });
      await queryCommunicationDetails(
        observed,
        event.id,
        owner.id,
        fixtures[4].id,
      );
      assert.equal(recipientQueries, 1);
    });
    for (const [count, counts, label] of [
      [0, [0, 0, 0, 0], "No recipients"],
      [4, [4, 0, 0, 0], "Pending"],
      [4, [0, 4, 0, 0], "In progress"],
      [4, [1, 1, 2, 0], "In progress"],
      [4, [0, 0, 4, 0], "Sent"],
      [4, [0, 0, 0, 4], "Failed"],
      [4, [0, 0, 3, 1], "Completed with failures"],
      [4, [1, 1, 1, 1], "In progress · partial failures"],
    ] as const) {
      assert.equal(
        communicationDeliverySummary(count, {
          PENDING: counts[0],
          PROCESSING: counts[1],
          SENT: counts[2],
          FAILED: counts[3],
        }).label,
        label,
      );
    }
    for (const data of [
      { startsAt: new Date("2099-01-01"), endsAt: new Date("2099-01-02") },
      {
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 60000),
      },
      { startsAt: new Date("2020-01-01"), endsAt: new Date("2020-01-02") },
      { cancelledAt: new Date(), cancellationReason: "Verification" },
      { archivedAt: new Date() },
      { archivedAt: null },
    ]) {
      await prisma.event.update({ where: { id: event.id }, data });
      assert.ok(await history());
      assert.ok(await details(manual.id));
    }
    console.log(
      "PASS: bounded detail projection, status summary cases and lifecycle-independent reads",
    );

    // Listen in this disposable DB only. No sendMail/deliverClaimedEmail call.
    const notices: unknown[] = [];
    connection.on("notification", (message) => {
      if (message.channel === applicationNotificationChannel) {
        notices.push(parseApplicationNotification(message.payload));
      }
    });
    await connection.query(`LISTEN ${applicationNotificationChannel}`);
    async function expectNotice(previous: number) {
      for (let i = 0; i < 100 && notices.length === previous; i++) {
        await delay(10);
      }
      assert.equal(notices.length, previous + 1);
      assert.deepEqual(notices.at(-1), {
        type: "event.changed",
        eventId: event.id,
        userId: null,
      });
    }
    const recipient = await prisma.emailOutbox.findFirstOrThrow({
      where: { communicationId: fixtures[1].id },
    });
    await prisma.emailOutbox.update({
      where: { id: recipient.id },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(0) },
    });
    const worker = randomUUID();
    let previous = notices.length;
    const claimed = await claimEmailBatch(worker);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].status, "PROCESSING");
    assert.equal(claimed[0].attempts, 1);
    await expectNotice(previous);
    previous = notices.length;
    assert.equal(
      await finishEmailDelivery(claimed[0], "stale-worker", null),
      0,
    );
    assert.equal(
      await finishEmailDelivery({ ...claimed[0], attempts: 2 }, worker, null),
      0,
    );
    await delay(50);
    assert.equal(notices.length, previous);
    assert.equal(
      (
        await prisma.emailOutbox.findUniqueOrThrow({
          where: { id: recipient.id },
        })
      ).status,
      "PROCESSING",
    );
    assert.equal(await finishEmailDelivery(claimed[0], worker, null), 1);
    await expectNotice(previous);
    const sent = await prisma.emailOutbox.findUniqueOrThrow({
      where: { id: recipient.id },
    });
    assert.equal(sent.status, "SENT");
    assert.ok(sent.sentAt);
    previous = notices.length;
    assert.equal(await finishEmailDelivery(claimed[0], worker, null), 0);
    await delay(50);
    assert.equal(notices.length, previous);

    for (const attempts of [1, 2, 3, 4, 5]) {
      await prisma.emailOutbox.update({
        where: { id: recipient.id },
        data: {
          status: "PROCESSING",
          attempts,
          lockedBy: worker,
          lockedAt: new Date(),
          sentAt: null,
        },
      });
      previous = notices.length;
      assert.equal(
        await finishEmailDelivery(
          { id: recipient.id, attempts },
          worker,
          "Email delivery failed.",
        ),
        1,
      );
      await expectNotice(previous);
      const failed = await prisma.emailOutbox.findUniqueOrThrow({
        where: { id: recipient.id },
      });
      assert.equal(failed.status, attempts === 5 ? "FAILED" : "PENDING");
      assert.equal(failed.lockedBy, null);
      const expectedDelay = [60000, 300000, 1800000, 7200000][attempts - 1];

      if (attempts < 5) {
        assert.ok(failed.nextAttemptAt);
        assert.ok(
          Math.abs(
            failed.nextAttemptAt.getTime() -
              failed.updatedAt.getTime() -
              expectedDelay,
          ) < 10,
        );
      } else {
        assert.equal(failed.nextAttemptAt, null);
      }
    }
    await prisma.emailOutbox.update({
      where: { id: recipient.id },
      data: {
        status: "PROCESSING",
        attempts: 5,
        lockedBy: worker,
        lockedAt: new Date(0),
      },
    });
    previous = notices.length;
    const exhausted = await claimEmailBatch(worker);
    assert.equal(exhausted[0].status, "FAILED");
    assert.equal(exhausted[0].attempts, 5);
    await expectNotice(previous);
    previous = notices.length;
    assert.equal(
      await finishEmailDelivery(
        { id: recipient.id, attempts: 4 },
        "stale-worker",
        null,
      ),
      0,
    );
    await delay(50);
    assert.equal(notices.length, previous);
    console.log(
      "PASS: real claim/SENT/retry PENDING/FAILED/expired fifth lease, retry delays, fencing and routing-only notifications",
    );

    const originalTransaction = prisma.$transaction;
    // Block the real claim transaction before commit and prove there is no
    // invalidation until commit, then force rollback and notification failure.
    await prisma.emailOutbox.update({
      where: { id: recipient.id },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(0) },
    });
    let release: () => void = () => {};
    let ready: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let holdClaim = true;
    prisma.$transaction = ((
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) =>
      originalTransaction.call(
        prisma,
        async (tx: Prisma.TransactionClient) => {
          const result = await callback(tx);

          if (holdClaim) {
            holdClaim = false;
            ready();
            await hold;
          }

          return result;
        },
        options,
      )) as unknown as typeof prisma.$transaction;
    previous = notices.length;
    await verifyHeldClaim({
      claim: () => claimEmailBatch(worker),
      started,
      verify: async () => {
        await delay(50);
        assert.equal(notices.length, previous);
        assert.equal(
          (
            await prisma.emailOutbox.findUniqueOrThrow({
              where: { id: recipient.id },
            })
          ).status,
          "PENDING",
        );
      },
      release,
      restore: () => {
        prisma.$transaction = originalTransaction;
      },
    });
    await expectNotice(previous);
    await prisma.emailOutbox.update({
      where: { id: recipient.id },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(0) },
    });
    const rollback = new Error("Verification rollback");
    prisma.$transaction = ((
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) =>
      originalTransaction.call(
        prisma,
        async (tx: Prisma.TransactionClient) => {
          await callback(tx);
          throw rollback;
        },
        options,
      )) as unknown as typeof prisma.$transaction;
    previous = notices.length;

    try {
      await assert.rejects(
        claimEmailBatch(worker),
        (error) => error === rollback,
      );
    } finally {
      prisma.$transaction = originalTransaction;
    }
    await delay(50);
    assert.equal(notices.length, previous);
    assert.equal(
      (
        await prisma.emailOutbox.findUniqueOrThrow({
          where: { id: recipient.id },
        })
      ).status,
      "PENDING",
    );
    const finalClaim = await claimEmailBatch(worker);
    await expectNotice(previous);
    let notificationFailures = 0;
    prisma.$transaction = (() => {
      notificationFailures++;

      return Promise.reject(new Error("Simulated notification outage"));
    }) as typeof prisma.$transaction;

    try {
      assert.equal(await finishEmailDelivery(finalClaim[0], worker, null), 1);
      await delay(20);
      assert.equal(notificationFailures, 1);
      assert.equal(
        (
          await prisma.emailOutbox.findUniqueOrThrow({
            where: { id: recipient.id },
          })
        ).status,
        "SENT",
      );
    } finally {
      prisma.$transaction = originalTransaction;
    }
    console.log(
      "PASS: no pre-commit/rollback signal; notification failure leaves committed SENT and success result intact",
    );
    const legacy = await prisma.emailOutbox.create({
      data: {
        type: "APPLICATION_REJECTED",
        recipientEmail: "legacy@example.test",
        payload: {},
        deduplicationKey: randomUUID(),
        nextAttemptAt: new Date(0),
      },
    });
    previous = notices.length;
    const legacyClaim = await claimEmailBatch(worker);
    assert.equal(legacyClaim.length, 1);
    assert.equal(legacyClaim[0].id, legacy.id);
    assert.equal(await finishEmailDelivery(legacyClaim[0], worker, null), 1);
    await delay(50);
    assert.equal(notices.length, previous);
    console.log(
      "PASS: legacy null association still claims/completes without history notifications",
    );
    await checkInvalidationConcurrency();
  } catch (error) {
    failure = { error };
  } finally {
    // Attempt every cleanup step even if a previous one fails.
    await finishVerification(failure, [
      () => db?.$disconnect(),
      () => connection?.end(),
      () => {
        process.env.DATABASE_URL = originalUrl;
      },
      async () => {
        if (created) {
          assert.match(databaseName, /^event_flow_verify_27d_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        }
      },
      () => admin.end(),
    ]);
  }

  console.log(
    "27D targeted checks passed. Isolated database dropped; no persistent fixtures; no SMTP.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
