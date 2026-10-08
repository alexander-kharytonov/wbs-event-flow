// Targeted 27C verification in a disposable isolated PostgreSQL database.
// Applies the existing migrations, never starts a dispatcher/server or calls SMTP.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

type VerificationFailure = { error: unknown } | undefined;
type CleanupStep = { label: string; run: () => unknown | Promise<unknown> };

// Each cleanup step gets its own attempt; cleanup never replaces the test error.
async function finishVerification(
  failure: VerificationFailure,
  steps: CleanupStep[],
  report: (label: string, error: unknown) => void = console.error,
) {
  const errors: unknown[] = [];

  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      errors.push(error);
      report(step.label, error);
    }
  }

  if (failure) {
    throw failure.error;
  }

  if (errors.length) {
    throw new AggregateError(errors, "Verification cleanup failed.");
  }
}

async function checkCleanupFailures() {
  const originalError = new Error("Original verification failure");

  for (const failingSteps of [
    ["disconnect"],
    ["drop"],
    ["disconnect", "drop"],
  ]) {
    for (const failure of [undefined, { error: originalError }]) {
      const attempted: string[] = [];
      const reported: string[] = [];
      const steps = ["disconnect", "restore", "drop", "admin.end"].map(
        (label) => ({
          label,
          run: async () => {
            attempted.push(label);

            if (failingSteps.includes(label)) {
              throw new Error(`${label} failure`);
            }
          },
        }),
      );
      await assert.rejects(
        finishVerification(failure, steps, (label) => reported.push(label)),
        (error) =>
          failure ? error === originalError : error instanceof AggregateError,
      );
      assert.deepEqual(attempted, [
        "disconnect",
        "restore",
        "drop",
        "admin.end",
      ]);
      assert.deepEqual(reported, failingSteps);
    }
  }
  console.log(
    "PASS: independent cleanup after disconnect/DROP failures; original error preserved",
  );
}

async function main() {
  await checkCleanupFailures();
  loadEnvConfig(process.cwd(), true);
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl);
  const databaseName = `event_flow_verify_27c_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: originalUrl });
  let migrationClient: Client | undefined;
  let failure: VerificationFailure;
  let db: typeof import("@/lib/prisma")["prisma"] | undefined;
  let created = false;

  try {
    await admin.connect();
    // Identifier is generated here, never supplied externally.
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
    created = true;
    const isolatedUrl = new URL(originalUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = isolatedUrl.toString();
    migrationClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await migrationClient.connect();
    assert.equal(
      (await migrationClient.query("SELECT current_database() AS name")).rows[0]
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
      await migrationClient.query(
        await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    }
    await migrationClient.end();
    migrationClient = undefined;

    const { prisma } = await import("@/lib/prisma");
    db = prisma;
    const [database] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT current_database() AS name`;
    assert.equal(database.name, databaseName);
    const { resolveManualAudience } = await import(
      "@/features/communications/server/audience"
    );
    const { enqueueManualCommunication, manualSendSchema } = await import(
      "@/features/communications/server/manual-enqueue"
    );
    const { previewManualMessage, sendManualMessage } = await import(
      "@/features/communications/server/manual-service"
    );
    const { queryCommunicationHistory } = await import(
      "@/features/communications/server/read-history"
    );
    const { loadManualCommunicationEmail } = await import(
      "@/features/communications/server/render"
    );
    const users = await Promise.all(
      ["owner", "manager", "reception", "foreign"].map((name) =>
        prisma.user.create({
          data: { name, email: `${name}@example.test`, emailVerified: true },
        }),
      ),
    );
    const [owner, manager, reception, foreign] = users;
    const organizer = await prisma.organizerProfile.create({
      data: { userId: owner.id },
    });
    async function event(published = true) {
      const result = await prisma.event.create({
        data: {
          organizerId: organizer.id,
          title: "Verification event",
          timezone: "UTC",
          startsAt: new Date("2026-01-01"),
          endsAt: new Date("2026-01-02"),
        },
      });

      if (published) {
        await prisma.eventRevision.create({
          data: {
            eventId: result.id,
            number: 1,
            contentVersion: 1,
            snapshot: {},
            publishedAt: new Date(),
          },
        });
      }

      return result;
    }
    const e = await event();
    await prisma.eventStaff.createMany({
      data: [
        { eventId: e.id, userId: manager.id, role: "MANAGER" },
        { eventId: e.id, userId: reception.id, role: "RECEPTION" },
      ],
    });
    const revision = await prisma.eventRevision.findFirstOrThrow({
      where: { eventId: e.id },
    });
    async function application(
      email: string,
      status: "PENDING" | "WITHDRAWN" | "APPROVED" = "PENDING",
    ) {
      return prisma.application.create({
        data: {
          eventId: e.id,
          eventRevisionId: revision.id,
          fullName: "Fixture",
          email,
          status,
        },
      });
    }
    const approved = await application("primary@example.test", "APPROVED");
    const registration = await prisma.registration.create({
      data: {
        eventId: e.id,
        sourceApplicationId: approved.id,
        attendeeName: "Primary",
        attendeeEmail: approved.email,
      },
    });
    const primary = await prisma.attendee.create({
      data: {
        registrationId: registration.id,
        kind: "PRIMARY",
        name: "Primary",
        email: approved.email,
      },
    });
    await prisma.attendee.createMany({
      data: [
        {
          registrationId: registration.id,
          kind: "GUEST",
          name: "Guest",
          email: " GUEST@EXAMPLE.TEST ",
        },
        {
          registrationId: registration.id,
          kind: "GUEST",
          name: "Duplicate",
          email: "guest@example.test",
        },
        { registrationId: registration.id, kind: "GUEST", name: "Missing" },
        {
          registrationId: registration.id,
          kind: "GUEST",
          name: "Invalid",
          email: "invalid",
        },
        {
          registrationId: registration.id,
          kind: "GUEST",
          name: "Revoked",
          email: "revoked@example.test",
          createdAt: new Date("2020-01-01"),
          revokedAt: new Date(),
        },
      ],
    });
    await prisma.attendance.create({
      data: {
        attendeeId: primary.id,
        method: "MANUAL",
        checkedInAt: new Date(),
      },
    });
    const revokedApplication = await application(
      "revoked-party@example.test",
      "APPROVED",
    );
    await prisma.registration.create({
      data: {
        eventId: e.id,
        sourceApplicationId: revokedApplication.id,
        attendeeName: "Revoked party",
        attendeeEmail: revokedApplication.email,
        createdAt: new Date("2020-01-01"),
        revokedAt: new Date(),
        attendees: {
          create: {
            kind: "PRIMARY",
            name: "Revoked party",
            email: revokedApplication.email,
          },
        },
      },
    });
    await application("waiting@example.test");
    await application("withdrawn@example.test", "WITHDRAWN");
    async function audience(
      value: Parameters<typeof resolveManualAudience>[2],
    ) {
      return prisma.$transaction((tx) =>
        resolveManualAudience(tx, e.id, value),
      );
    }
    assert.deepEqual((await audience("ALL_ACTIVE_ATTENDEES")).emails, [
      "guest@example.test",
      "primary@example.test",
    ]);
    assert.equal((await audience("ALL_ACTIVE_ATTENDEES")).unavailableCount, 2);
    assert.deepEqual((await audience("PRIMARY_ATTENDEES")).emails, [
      "primary@example.test",
    ]);
    assert.deepEqual((await audience("CHECKED_IN")).emails, [
      "primary@example.test",
    ]);
    assert.deepEqual((await audience("NOT_ARRIVED")).emails, [
      "guest@example.test",
    ]);
    assert.deepEqual((await audience("PENDING_APPLICATIONS")).emails, [
      "waiting@example.test",
    ]);
    assert.deepEqual((await audience("EVENT_STAFF")).emails, [
      "manager@example.test",
      "owner@example.test",
      "reception@example.test",
    ]);
    console.log(
      "PASS: all six audiences, admission/revocation, missing/invalid/duplicate emails, attendance and current attempts",
    );

    const input = {
      eventId: e.id,
      audience: "ALL_ACTIVE_ATTENDEES" as const,
      subject: "Hello <safe>",
      message: "Line 1\r\nLine 2 <script>",
      requestKey: randomUUID(),
    };
    for (const field of [
      "recipientEmails",
      "recipientCount",
      "sender",
      "actor",
      "contextSnapshot",
      "payload",
    ]) {
      assert.equal(
        manualSendSchema.safeParse({ ...input, [field]: "injected" }).success,
        false,
      );
    }
    const beforePreview = await prisma.communication.count();
    const preview = await previewManualMessage(owner.id, {
      eventId: e.id,
      audience: input.audience,
    });
    assert.ok(preview.success);
    assert.deepEqual(Object.keys(preview).sort(), [
      "audience",
      "recipientCount",
      "success",
      "unavailableCount",
    ]);
    assert.equal(preview.recipientCount, 2);
    assert.equal(await prisma.communication.count(), beforePreview);
    assert.equal(await prisma.emailOutbox.count(), 0);
    for (const actor of [reception, foreign]) {
      const denied = await previewManualMessage(actor.id, {
        eventId: e.id,
        audience: "EVENT_STAFF",
      });
      assert.equal(denied.success, false);
      assert.equal("recipientCount" in denied, false);
      assert.equal((await sendManualMessage(actor.id, input)).success, false);
      assert.equal(
        await prisma.$transaction((tx) =>
          queryCommunicationHistory(tx, e.id, actor.id),
        ),
        null,
      );
    }
    await prisma.attendee.create({
      data: {
        registrationId: registration.id,
        kind: "GUEST",
        name: "Fresh",
        email: "fresh@example.test",
      },
    });
    const sent = await sendManualMessage(owner.id, input);
    assert.ok(sent.success);
    assert.equal(sent.recipientCount, 3);
    const frozen = await loadManualCommunicationEmail(prisma, sent.id);
    assert.ok(frozen.html.includes("&lt;script&gt;"));
    assert.ok(!frozen.html.includes("<script>"));
    await prisma.event.update({
      where: { id: e.id },
      data: { title: "Changed live title" },
    });
    await prisma.attendee.update({
      where: { id: primary.id },
      data: { revokedAt: new Date() },
    });
    const replay = await sendManualMessage(owner.id, {
      ...input,
      message: input.message.replace(/\r\n/g, "\n"),
    });
    assert.deepEqual(replay, sent);
    assert.equal(await prisma.emailOutbox.count(), 3);
    assert.equal(
      (await sendManualMessage(owner.id, { ...input, subject: "Conflict" }))
        .success,
      false,
    );
    const secondActor = await sendManualMessage(manager.id, input);
    assert.ok(secondActor.success);
    assert.notEqual(secondActor.id, sent.id);
    assert.deepEqual(
      await loadManualCommunicationEmail(prisma, sent.id),
      frozen,
    );
    console.log(
      "PASS: strict input, RBAC, read-only safe preview, fresh send, immutable rendering, replay/conflict and actor-scoped keys",
    );

    const draft = await event(false);
    assert.equal(
      (await sendManualMessage(owner.id, { ...input, eventId: draft.id }))
        .success,
      false,
    );
    await prisma.event.update({
      where: { id: e.id },
      data: { archivedAt: new Date() },
    });
    assert.equal(
      (
        await sendManualMessage(owner.id, {
          ...input,
          requestKey: randomUUID(),
        })
      ).success,
      false,
    );
    assert.ok(
      await prisma.$transaction((tx) =>
        queryCommunicationHistory(tx, e.id, manager.id),
      ),
    );
    await prisma.event.update({
      where: { id: e.id },
      data: {
        archivedAt: null,
        cancelledAt: new Date(),
        cancellationReason: "Fixture",
      },
    });
    assert.ok(
      (
        await sendManualMessage(owner.id, {
          ...input,
          requestKey: randomUUID(),
        })
      ).success,
    );
    const empty = await event();
    assert.equal(
      (await sendManualMessage(owner.id, { ...input, eventId: empty.id }))
        .success,
      false,
    );
    assert.equal(
      await prisma.communication.count({ where: { eventId: empty.id } }),
      0,
    );
    console.log(
      "PASS: draft/archive denial, completed/cancelled/restored/unpublished eligibility, history while archived, zero-recipient rejection",
    );

    const rollbackEvent = await event();
    for (const failurePoint of [
      "outbox",
      "outboxNotify",
      "eventNotify",
    ] as const) {
      const before = await prisma.communication.count();
      const beforeOutbox = await prisma.emailOutbox.count();
      let advisoryPassed = false;
      let insertsObserved = false;
      let notifyCalls = 0;
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            if (failurePoint === "outbox") {
              // Constraint trigger exists only in this transaction and is rolled back.
              await tx.$executeRawUnsafe(
                `CREATE FUNCTION verify_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''verification failure''; END'`,
              );
              await tx.$executeRawUnsafe(
                `CREATE TRIGGER verify_fail_outbox BEFORE INSERT ON "EmailOutbox" FOR EACH ROW EXECUTE FUNCTION verify_fail_outbox()`,
              );
            }
            const failingTx = new Proxy(tx, {
              get(target, key) {
                if (key === "$executeRaw" && failurePoint !== "outbox") {
                  return async (...args: Parameters<typeof tx.$executeRaw>) => {
                    const [query] = args;
                    const sql = Array.isArray(query) ? query.join("") : "";

                    if (sql.includes("pg_notify(")) {
                      notifyCalls += 1;
                      const failureCall =
                        failurePoint === "outboxNotify" ? 1 : 2;

                      if (notifyCalls === failureCall) {
                        assert.equal(advisoryPassed, true);
                        const inserted = await tx.communication.findMany({
                          where: { eventId: rollbackEvent.id },
                          select: { id: true, recipientCount: true },
                        });
                        assert.equal(inserted.length, 1);
                        assert.equal(inserted[0].recipientCount, 1);
                        assert.equal(
                          await tx.emailOutbox.count({
                            where: { communicationId: inserted[0].id },
                          }),
                          1,
                        );
                        insertsObserved = true;
                        // Real PostgreSQL NOTIFY error: payloads must be < 8000 bytes.
                        // The advisory lock and inserts above used the real transaction.

                        return tx.$executeRaw`SELECT pg_notify(${String(args[1])}::text, ${"x".repeat(8000)}::text)`;
                      }
                    }

                    const result = await tx.$executeRaw(...args);

                    if (sql.includes("pg_advisory_xact_lock(")) {
                      advisoryPassed = true;
                    }

                    return result;
                  };
                }

                return Reflect.get(target, key);
              },
            });
            await enqueueManualCommunication(failingTx, owner.id, {
              ...input,
              eventId: rollbackEvent.id,
              audience: "EVENT_STAFF",
              requestKey: randomUUID(),
            });
          },
          { isolationLevel: "ReadCommitted" },
        ),
        (error) =>
          failurePoint === "outbox"
            ? String(error).includes("verification failure")
            : String(error).includes("payload string too long"),
      );

      if (failurePoint !== "outbox") {
        assert.equal(advisoryPassed, true);
        assert.equal(insertsObserved, true);
        assert.equal(notifyCalls, failurePoint === "outboxNotify" ? 1 : 2);
      }
      assert.equal(await prisma.communication.count(), before);
      assert.equal(await prisma.emailOutbox.count(), beforeOutbox);
      assert.equal(
        await prisma.emailOutbox.count({
          where: { communication: { eventId: rollbackEvent.id } },
        }),
        0,
      );
    }
    console.log(
      "PASS: actual Outbox failure and both NOTIFY failures; inserts observed after real admission lock, both entities rolled back",
    );

    // Admission fixtures bypass orchestration only to place the database at exact
    // limits. Concurrent contenders always execute the real send service.
    async function fixtureSend(
      eventId: string,
      actorUserId: string,
      count = 0,
      old = false,
    ) {
      return prisma.communication.create({
        data: {
          eventId,
          actorUserId,
          actorNameSnapshot: "Fixture",
          actorRoleSnapshot: "OWNER",
          kind: "MANUAL",
          audience: "EVENT_STAFF",
          subject: "Fixture",
          message: "Fixture",
          contextSnapshot: {
            schemaVersion: 1,
            kind: "MANUAL",
            eventTitle: "Fixture",
          },
          recipientCount: count,
          idempotencyKey: randomUUID(),
          requestDigest: "a".repeat(64),
          createdAt: old ? new Date("2020-01-01") : new Date(),
          deliveries: {
            createMany: {
              data: Array.from({ length: count }, (_, index) => ({
                type: "MANUAL_EVENT_MESSAGE",
                recipientEmail: `fixture${index}@example.test`,
                deduplicationKey: randomUUID(),
                payload: {},
              })),
            },
          },
        },
      });
    }
    async function clearSends() {
      await prisma.emailOutbox.deleteMany();
      await prisma.communication.deleteMany();
    }
    async function race(eventIds: string[], expected = 1) {
      const results = await Promise.all(
        eventIds.map((eventId) =>
          sendManualMessage(owner.id, {
            ...input,
            eventId,
            audience: "EVENT_STAFF",
            requestKey: randomUUID(),
          }),
        ),
      );
      assert.equal(results.filter((result) => result.success).length, expected);
    }
    await clearSends();
    const raceA = await event();
    const raceB = await event();
    for (let i = 0; i < 4; i++) await fixtureSend(raceA.id, owner.id);
    await race([raceA.id, raceA.id]);
    assert.equal(
      await prisma.communication.count({ where: { eventId: raceA.id } }),
      5,
    );
    await clearSends();
    const historyEvents = await Promise.all(
      Array.from({ length: 10 }, () => event()),
    );
    for (let i = 0; i < 9; i++)
      await fixtureSend(historyEvents[i].id, owner.id);
    await race([raceA.id, raceB.id]);
    assert.equal(
      await prisma.communication.count({ where: { actorUserId: owner.id } }),
      10,
    );
    await clearSends();
    await fixtureSend(raceA.id, owner.id, 1999, true);
    await race([raceA.id, raceA.id]);
    assert.equal(await prisma.emailOutbox.count(), 2000);
    await clearSends();
    for (let i = 0; i < 10; i++)
      await fixtureSend(
        historyEvents[i].id,
        manager.id,
        i === 9 ? 999 : 1000,
        true,
      );
    await race([raceA.id, raceB.id]);
    assert.equal(await prisma.emailOutbox.count(), 10000);
    console.log(
      "PASS: real concurrent sends at event/hour, actor/hour, event outstanding and global outstanding limits; no overspend",
    );

    await clearSends();
    const manyEvent = await event();
    const manyRevision = await prisma.eventRevision.findFirstOrThrow({
      where: { eventId: manyEvent.id },
    });
    await prisma.application.createMany({
      data: Array.from({ length: 1000 }, (_, index) => ({
        eventId: manyEvent.id,
        eventRevisionId: manyRevision.id,
        fullName: "Fixture",
        email: `many${index}@example.test`,
      })),
    });
    const manyInput = {
      ...input,
      eventId: manyEvent.id,
      audience: "PENDING_APPLICATIONS",
      requestKey: randomUUID(),
    };
    const thousand = await sendManualMessage(owner.id, manyInput);
    assert.ok(thousand.success);
    assert.equal(thousand.recipientCount, 1000);
    await prisma.application.create({
      data: {
        eventId: manyEvent.id,
        eventRevisionId: manyRevision.id,
        fullName: "Extra",
        email: "extra@example.test",
      },
    });
    assert.equal(
      (
        await sendManualMessage(owner.id, {
          ...manyInput,
          requestKey: randomUUID(),
        })
      ).success,
      false,
    );
    assert.equal(
      await prisma.communication.count({ where: { eventId: manyEvent.id } }),
      1,
    );
    // Model a committed send whose response was lost: retry the exact payload.
    assert.deepEqual(await sendManualMessage(owner.id, manyInput), thousand);
    assert.equal(
      await prisma.emailOutbox.count({
        where: { communicationId: thousand.id },
      }),
      1000,
    );
    assert.equal(
      (
        await sendManualMessage(owner.id, {
          ...manyInput,
          message: "Changed attempted payload",
        })
      ).success,
      false,
    );
    await prisma.eventStaff.create({
      data: { eventId: manyEvent.id, userId: manager.id, role: "MANAGER" },
    });
    // An authorized different actor cannot recover the owner's record. Their
    // separate send is rejected by the now oversized audience.
    assert.equal(
      (await sendManualMessage(manager.id, manyInput)).success,
      false,
    );
    await prisma.application.createMany({
      data: Array.from({ length: 9000 }, (_, index) => ({
        eventId: manyEvent.id,
        eventRevisionId: manyRevision.id,
        fullName: "Fixture",
        email: `overflow${index}@example.test`,
      })),
    });
    const overflow = await previewManualMessage(owner.id, {
      eventId: manyEvent.id,
      audience: "PENDING_APPLICATIONS",
    });
    assert.ok(!overflow.success && overflow.error.includes("safely"));
    assert.deepEqual(await sendManualMessage(owner.id, manyInput), thousand);
    assert.equal(
      await prisma.communication.count({ where: { eventId: manyEvent.id } }),
      1,
    );
    assert.equal(
      await prisma.emailOutbox.count({
        where: { communicationId: thousand.id },
      }),
      1000,
    );
    console.log(
      "PASS: 1000 accepted; exact replay after 1001/10001 growth adds no rows; changed payload and other actor rejected",
    );

    await clearSends();
    for (let i = 0; i < 25; i++) await fixtureSend(e.id, owner.id);
    const rows = await prisma.communication.findMany({
      where: { eventId: e.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    await prisma.emailOutbox.createMany({
      data: (["PENDING", "PROCESSING", "SENT", "FAILED"] as const).map(
        (status) => ({
          communicationId: rows[0].id,
          type: "MANUAL_EVENT_MESSAGE",
          status,
          recipientEmail: `${status.toLowerCase()}@example.test`,
          deduplicationKey: randomUUID(),
          payload: {},
        }),
      ),
    });
    const history = await prisma.$transaction(
      (tx) => queryCommunicationHistory(tx, e.id, manager.id),
      { isolationLevel: "RepeatableRead" },
    );
    assert.ok(history);
    assert.equal(history.items.length, 20);
    assert.deepEqual(
      history.items.map((row) => row.id),
      rows.slice(0, 20).map((row) => row.id),
    );
    assert.deepEqual(history.items[0].deliveryCounts, {
      PENDING: 1,
      PROCESSING: 1,
      SENT: 1,
      FAILED: 1,
    });
    const next = await prisma.$transaction((tx) =>
      queryCommunicationHistory(tx, e.id, owner.id, history.nextCursor),
    );
    assert.equal(next?.items.length, 5);
    for (const row of history.items) {
      for (const forbidden of [
        "message",
        "payload",
        "recipientEmail",
        "requestDigest",
        "lastError",
        "lockedBy",
        "contextSnapshot",
      ]) {
        assert.equal(forbidden in row, false);
      }
    }
    const otherHistory = await prisma.$transaction((tx) =>
      queryCommunicationHistory(tx, raceA.id, owner.id, rows[0].id),
    );
    assert.equal(otherHistory, null);
    console.log(
      "PASS: history scope, ordering, keyset pagination, aggregate status counts, safe DTO",
    );
  } catch (error) {
    failure = { error };
  } finally {
    await finishVerification(failure, [
      { label: "Prisma disconnect failed", run: () => db?.$disconnect() },
      {
        label: "Migration connection cleanup failed",
        run: () => migrationClient?.end(),
      },
      {
        label: "DATABASE_URL restoration failed",
        run: () => {
          process.env.DATABASE_URL = originalUrl;
        },
      },
      {
        label: `DROP failed; manually remove verification database: ${databaseName}`,
        run: async () => {
          if (created) {
            // Only this locally generated name can reach DROP, never the source URL.
            assert.match(databaseName, /^event_flow_verify_27c_[a-f0-9]{32}$/);
            await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
          }
        },
      },
      { label: "Admin connection cleanup failed", run: () => admin.end() },
    ]);
  }
  console.log(
    "27C targeted DB checks passed. Isolated database dropped; no persistent fixture data; no SMTP.",
  );
}

main().catch((error) => {
  console.error(error);
  console.error(
    "Manual Communications verification failed; see the failing assertion in a local diagnostic run. Isolated database cleanup was attempted.",
  );
  process.exitCode = 1;
});
