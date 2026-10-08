// Targeted 27A verification. All DB fixtures and writes are rolled back. No SMTP.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import {
  assertManualAdmissionCapacity,
  checkManualCommunicationAdmission,
} from "@/features/communications/server/admission";
import {
  communicationSubjectSchema,
  manualAudienceSchema,
  manualContentSchema,
  manualMessageSchema,
  normalizeRecipientEmails,
  transactionalContextSchema,
} from "@/features/communications/server/contracts";
import {
  captureCommunicationActor,
  getCommunicationSendEligibility,
} from "@/features/communications/server/eligibility";
import { enqueueTransactionalCommunication } from "@/features/communications/server/enqueue";
import {
  communicationSummarySelect,
  deliveryStatusMeaning,
  projectCommunicationActor,
  projectCommunicationContext,
  projectDeliveryCounts,
  projectSafeRecipientStatus,
} from "@/features/communications/server/history";
import {
  loadManualCommunicationEmail,
  renderManualCommunication,
} from "@/features/communications/server/render";
import { hasEventPermission } from "@/features/events/server/event-access";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { prisma } = await import("@/lib/prisma");
  const { renderOutboxEmail } = await import("@/lib/email-outbox/render");
  const rollback = new Error("Intentional verification rollback");
  let checks = 0;
  function check(condition: unknown) {
    assert.ok(condition);
    checks++;
  }

  try {
    check(communicationSubjectSchema.safeParse("😀".repeat(200)).success);
    check(!communicationSubjectSchema.safeParse("😀".repeat(201)).success);

    for (const subject of [
      "",
      "a\rBcc:x",
      "a\nb",
      "a\t",
      "a\u2028b",
      "a\u2029b",
      "a\u0000",
      "a\u0085",
      "a\u202e",
      "\ud800",
    ]) {
      check(!communicationSubjectSchema.safeParse(subject).success);
    }

    assert.equal(manualMessageSchema.parse("a\r\nb\t"), "a\nb\t");
    check(manualMessageSchema.safeParse("😀".repeat(10_000)).success);
    check(!manualMessageSchema.safeParse("😀".repeat(10_001)).success);

    for (const message of [
      "",
      "a\rb",
      "a\u0000",
      "a\u000b",
      "a\u007f",
      "a\u0085",
      "a\u202e",
      "a\u2066",
      "\ud800",
    ]) {
      check(!manualMessageSchema.safeParse(message).success);
    }

    check(
      !manualContentSchema.safeParse({
        subject: "Hello",
        message: "Text",
        from: "spoof@example.test",
      }).success,
    );
    check(!manualAudienceSchema.safeParse("APPROVED_APPLICATIONS").success);
    assert.deepEqual(
      normalizeRecipientEmails([
        " A@EXAMPLE.TEST ",
        "a@example.test",
        "b@example.test",
      ]),
      ["a@example.test", "b@example.test"],
    );
    const context = {
      schemaVersion: 1,
      kind: "TRANSACTIONAL",
      trigger: "APPLICATION_REJECTED",
    } as const;

    for (const field of [
      "anonymousAccessUrl",
      "ticketId",
      "credential",
      "payload",
      "session",
    ]) {
      check(
        !transactionalContextSchema.safeParse({
          ...context,
          [field]: "private",
        }).success,
      );
    }

    assert.deepEqual(projectCommunicationContext(context), context);
    assert.deepEqual(projectDeliveryCounts([{ status: "SENT", count: 2 }]), {
      PENDING: 0,
      PROCESSING: 0,
      SENT: 2,
      FAILED: 0,
    });
    assert.equal(deliveryStatusMeaning.SENT, "SMTP transport accepted");
    const statusRow = {
      id: randomUUID(),
      recipientEmail: "a@example.test",
      status: "SENT" as const,
      sentAt: new Date(),
      payload: { secret: "hidden" },
      lastError: "hidden",
      lockedBy: "hidden",
    };
    assert.deepEqual(Object.keys(projectSafeRecipientStatus(statusRow)), [
      "id",
      "recipientEmail",
      "status",
      "sentAt",
    ]);

    for (const role of ["OWNER", "MANAGER", "RECEPTION"] as const) {
      for (const permission of [
        "communications.read",
        "communications.send",
      ] as const) {
        assert.equal(
          hasEventPermission(role, permission),
          role !== "RECEPTION",
        );
      }
    }

    const manual = {
      kind: "MANUAL",
      subject: "Subject <safe>",
      message: '<img src=x>\r\nSecond & "line"\t!',
      audience: "EVENT_STAFF",
      contextSnapshot: {
        schemaVersion: 1,
        kind: "MANUAL",
        eventTitle: "Frozen event",
      },
    };
    const rendered = renderManualCommunication(manual);
    check(
      rendered.html.includes(
        "&lt;img src=x&gt;<br>Second &amp; &quot;line&quot;",
      ),
    );
    check(rendered.text.includes('<img src=x>\nSecond & "line"\t!'));
    check(!rendered.html.includes("<img") && !rendered.html.includes("href="));
    const boundary = {
      recipientCount: 1000,
      eventSends: 4,
      actorSends: 9,
      eventOutstanding: 1000,
      globalOutstanding: 9000,
    };
    assertManualAdmissionCapacity(boundary);

    for (const change of [
      { recipientCount: 1001 },
      { eventSends: 5 },
      { actorSends: 10 },
      { eventOutstanding: 1001 },
      { globalOutstanding: 9001 },
    ]) {
      assert.throws(() =>
        assertManualAdmissionCapacity({ ...boundary, ...change }),
      );
    }

    const fixtureEventId = randomUUID();
    const fixtureActorId = randomUUID();
    const baselineLegacy = await prisma.emailOutbox.count({
      where: { communicationId: null },
    });
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              name: "Verification owner",
              email: `${randomUUID()}@example.test`,
              emailVerified: true,
            },
          });
          const organizer = await tx.organizerProfile.create({
            data: { userId: user.id },
          });
          await tx.user.create({
            data: {
              id: fixtureActorId,
              name: "Verification manager",
              email: `${randomUUID()}@example.test`,
              emailVerified: true,
            },
          });
          const event = await tx.event.create({
            data: {
              id: fixtureEventId,
              organizerId: organizer.id,
              title: "Rollback verification",
              startsAt: new Date(Date.now() + 3600000),
              endsAt: new Date(Date.now() + 7200000),
              timezone: "UTC",
            },
          });
          await tx.eventStaff.create({
            data: {
              eventId: event.id,
              userId: fixtureActorId,
              role: "MANAGER",
            },
          });
          assert.deepEqual(
            await getCommunicationSendEligibility(tx, event.id, user.id),
            { allowed: false, reason: "NEVER_PUBLISHED" },
          );
          await tx.eventRevision.create({
            data: {
              eventId: event.id,
              number: 1,
              contentVersion: 1,
              snapshot: {},
              publishedAt: new Date(),
            },
          });
          check(
            (await getCommunicationSendEligibility(tx, event.id, user.id))
              .allowed,
          );

          for (const dates of [
            {
              startsAt: new Date(Date.now() - 1000),
              endsAt: new Date(Date.now() + 10000),
            },
            {
              startsAt: new Date(Date.now() - 10000),
              endsAt: new Date(Date.now() - 1000),
            },
            { cancelledAt: new Date(), cancellationReason: "Verification" },
          ]) {
            await tx.event.update({ where: { id: event.id }, data: dates });
            check(
              (
                await getCommunicationSendEligibility(
                  tx,
                  event.id,
                  fixtureActorId,
                )
              ).allowed,
            );
          }

          await tx.event.update({
            where: { id: event.id },
            data: { archivedAt: new Date() },
          });
          assert.deepEqual(
            await getCommunicationSendEligibility(tx, event.id, user.id),
            { allowed: false, reason: "ARCHIVED" },
          );
          await tx.event.update({
            where: { id: event.id },
            data: { archivedAt: null },
          });
          check(
            (await getCommunicationSendEligibility(tx, event.id, user.id))
              .allowed,
          );
          await tx.eventStaff.update({
            where: {
              eventId_userId: { eventId: event.id, userId: fixtureActorId },
            },
            data: { role: "RECEPTION" },
          });
          assert.deepEqual(
            await getCommunicationSendEligibility(tx, event.id, fixtureActorId),
            { allowed: false, reason: "FORBIDDEN" },
          );
          await tx.eventStaff.update({
            where: {
              eventId_userId: { eventId: event.id, userId: fixtureActorId },
            },
            data: { role: "MANAGER" },
          });
          const actor = await captureCommunicationActor(tx, {
            userId: fixtureActorId,
            role: "MANAGER",
          });
          const input = {
            eventId: event.id,
            trigger: "APPLICATION_REJECTED" as const,
            subject: "An update on your application",
            contextSnapshot: context,
            actor,
            idempotencyKey: "verification:rejected",
            recipients: [
              {
                recipientEmail: " A@EXAMPLE.TEST ",
                deduplicationKey: `verification:${randomUUID()}`,
                payload: { schemaVersion: 1, applicantName: "Applicant" },
              },
            ],
          };
          const first = await enqueueTransactionalCommunication(tx, {
            ...input,
            recipients: [
              ...input.recipients,
              { ...input.recipients[0], recipientEmail: "a@example.test" },
            ],
          });
          assert.equal(first.recipientCount, 1);
          const replay = await enqueueTransactionalCommunication(tx, input);
          assert.equal(replay.id, first.id);
          assert.equal(replay.created, false);
          await assert.rejects(
            enqueueTransactionalCommunication(tx, {
              ...input,
              subject: "Changed",
            }),
            /idempotency conflict/,
          );
          await assert.rejects(
            enqueueTransactionalCommunication(tx, {
              ...input,
              requestDigest: "0".repeat(64),
            }),
            /digest mismatch/,
          );
          const outbox = await tx.emailOutbox.findFirstOrThrow({
            where: { communicationId: first.id },
          });
          assert.equal(outbox.recipientEmail, "a@example.test");
          const summary = await tx.communication.findUniqueOrThrow({
            where: { id: first.id },
            select: communicationSummarySelect,
          });
          check(!("payload" in summary) && !("requestDigest" in summary));

          // Savepoints isolate intentional SQL constraint failures inside rollback-only work.
          async function rejectsSql(action: () => Promise<unknown>) {
            await tx.$executeRawUnsafe("SAVEPOINT communication_verification");
            await assert.rejects(action);
            await tx.$executeRawUnsafe(
              "ROLLBACK TO SAVEPOINT communication_verification",
            );
            checks++;
          }

          await rejectsSql(() => tx.event.delete({ where: { id: event.id } }));
          await rejectsSql(() =>
            tx.communication.delete({ where: { id: first.id } }),
          );
          await rejectsSql(() =>
            tx.communication.update({
              where: { id: first.id },
              data: { recipientCount: -1 },
            }),
          );
          await rejectsSql(() =>
            tx.emailOutbox.create({
              data: {
                type: "APPLICATION_REJECTED",
                communicationId: first.id,
                recipientEmail: "a@example.test",
                payload: {},
                deduplicationKey: randomUUID(),
              },
            }),
          );
          await rejectsSql(() =>
            tx.emailOutbox.create({
              data: {
                type: "MANUAL_EVENT_MESSAGE",
                recipientEmail: "a@example.test",
                payload: {},
                deduplicationKey: randomUUID(),
              },
            }),
          );
          await rejectsSql(() =>
            enqueueTransactionalCommunication(tx, {
              ...input,
              idempotencyKey: "verification:collision",
            }),
          );
          assert.equal(
            await tx.communication.count({ where: { eventId: event.id } }),
            1,
          );

          await tx.eventStaff.delete({
            where: {
              eventId_userId: { eventId: event.id, userId: fixtureActorId },
            },
          });
          assert.deepEqual(
            projectCommunicationActor(
              await tx.communication.findUniqueOrThrow({
                where: { id: first.id },
              }),
            ),
            { name: actor.actorNameSnapshot, role: "MANAGER" },
          );
          await tx.user.delete({ where: { id: fixtureActorId } });
          const afterDelete = await tx.communication.findUniqueOrThrow({
            where: { id: first.id },
          });
          assert.equal(afterDelete.actorUserId, null);
          assert.equal(afterDelete.actorNameSnapshot, actor.actorNameSnapshot);
          assert.equal(afterDelete.actorRoleSnapshot, "MANAGER");

          const admitted = await checkManualCommunicationAdmission(tx, {
            eventId: event.id,
            actorUserId: user.id,
            recipientCount: 1000,
          });
          check(admitted.admittedAt instanceof Date);
          const manualRow = await tx.communication.create({
            data: {
              eventId: event.id,
              kind: "MANUAL",
              audience: "EVENT_STAFF",
              subject: manual.subject,
              message: manual.message.replace(/\r\n/g, "\n"),
              contextSnapshot: manual.contextSnapshot,
              actorUserId: user.id,
              actorNameSnapshot: user.name,
              actorRoleSnapshot: "OWNER",
              requestDigest: "a".repeat(64),
              recipientCount: 1,
              idempotencyKey: "verification:manual",
              createdAt: admitted.admittedAt,
              deliveries: {
                create: {
                  type: "MANUAL_EVENT_MESSAGE",
                  recipientEmail: "frozen@example.test",
                  payload: {},
                  deduplicationKey: randomUUID(),
                },
              },
            },
          });
          await tx.event.update({
            where: { id: event.id },
            data: {
              title: "Live title must not render",
              archivedAt: new Date(),
            },
          });
          assert.deepEqual(
            await loadManualCommunicationEmail(tx, manualRow.id),
            rendered,
          );
          await assert.rejects(loadManualCommunicationEmail(tx, first.id));

          for (let i = 0; i < 4; i++) {
            await tx.communication.create({
              data: {
                eventId: event.id,
                kind: "MANUAL",
                audience: "EVENT_STAFF",
                subject: "Limit",
                message: "Limit",
                contextSnapshot: manual.contextSnapshot,
                actorUserId: user.id,
                actorNameSnapshot: user.name,
                actorRoleSnapshot: "OWNER",
                requestDigest: "a".repeat(64),
                recipientCount: 0,
                idempotencyKey: `verification:limit:${i}`,
                createdAt: admitted.admittedAt,
              },
            });
          }

          await assert.rejects(
            checkManualCommunicationAdmission(tx, {
              eventId: event.id,
              actorUserId: user.id,
              recipientCount: 1,
            }),
            /frequency/,
          );
          // Legacy NULL uniqueness remains permissive, without duplicate dedup keys.
          await tx.emailOutbox.createMany({
            data: [1, 2].map(() => ({
              type: "APPLICATION_REJECTED",
              recipientEmail: "same@example.test",
              payload: { schemaVersion: 1, applicantName: "Applicant" },
              deduplicationKey: randomUUID(),
            })),
          });
          throw rollback;
        },
        { isolationLevel: "ReadCommitted", timeout: 20000 },
      ),
      (error) => error === rollback,
    );
    assert.equal(
      await prisma.event.count({ where: { id: fixtureEventId } }),
      0,
    );
    assert.equal(await prisma.user.count({ where: { id: fixtureActorId } }), 0);
    assert.equal(
      await prisma.emailOutbox.count({ where: { communicationId: null } }),
      baselineLegacy,
    );
    await assert.rejects(
      prisma.$transaction(
        (tx) =>
          checkManualCommunicationAdmission(tx, {
            eventId: fixtureEventId,
            actorUserId: fixtureActorId,
            recipientCount: 1,
          }),
        { isolationLevel: "RepeatableRead" },
      ),
      /ReadCommitted/,
    );

    // Isolate the new Event FK: no revision, application, registration or staff.
    const restrictedEventId = randomUUID();
    const restrictedCommunicationId = randomUUID();
    const restrictedOwnerId = randomUUID();
    const restrictedOrganizerId = randomUUID();
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          await tx.user.create({
            data: {
              id: restrictedOwnerId,
              name: "Communication FK verification owner",
              email: `${restrictedOwnerId}@example.test`,
            },
          });
          await tx.organizerProfile.create({
            data: { id: restrictedOrganizerId, userId: restrictedOwnerId },
          });
          await tx.event.create({
            data: {
              id: restrictedEventId,
              organizerId: restrictedOrganizerId,
              title: "Communication FK rollback verification",
              startsAt: new Date(Date.now() + 3600000),
              endsAt: new Date(Date.now() + 7200000),
              timezone: "UTC",
            },
          });
          await tx.communication.create({
            data: {
              id: restrictedCommunicationId,
              eventId: restrictedEventId,
              kind: "TRANSACTIONAL",
              trigger: "APPLICATION_REJECTED",
              subject: "Communication FK verification",
              contextSnapshot: context,
              recipientCount: 0,
              idempotencyKey: "verification:event-fk",
            },
          });
          await tx.$executeRawUnsafe("SAVEPOINT isolated_communication_fk");
          await assert.rejects(
            tx.event.delete({ where: { id: restrictedEventId } }),
            (error) => {
              assert.ok(
                error instanceof Error && "code" in error && "meta" in error,
              );
              assert.equal(error.code, "P2003");
              assert.ok(
                error.meta !== null &&
                  typeof error.meta === "object" &&
                  "driverAdapterError" in error.meta,
              );
              const adapterError = error.meta.driverAdapterError;
              assert.ok(adapterError instanceof Error);
              assert.partialDeepStrictEqual(adapterError.cause, {
                kind: "RestrictViolation",
                originalCode: "23001",
                constraint: { index: "Communication_eventId_fkey" },
              });

              return true;
            },
          );
          await tx.$executeRawUnsafe(
            "ROLLBACK TO SAVEPOINT isolated_communication_fk",
          );
          throw rollback;
        },
        { isolationLevel: "ReadCommitted", timeout: 20000 },
      ),
      (error) => error === rollback,
    );
    assert.equal(
      await prisma.event.count({ where: { id: restrictedEventId } }),
      0,
    );
    assert.equal(
      await prisma.communication.count({
        where: { id: restrictedCommunicationId },
      }),
      0,
    );
    assert.equal(
      await prisma.organizerProfile.count({
        where: { id: restrictedOrganizerId },
      }),
      0,
    );
    assert.equal(
      await prisma.user.count({ where: { id: restrictedOwnerId } }),
      0,
    );

    const emailEvent = {
      title: "Event",
      startsAt: "2026-10-08T10:00:00.000Z",
      endsAt: "2026-10-08T12:00:00.000Z",
      timezone: "UTC",
      publicId: randomUUID(),
    };
    const cases = [
      [
        "APPLICATION_RECEIVED",
        {
          schemaVersion: 1,
          applicantName: "Applicant",
          event: emailEvent,
          linkedApplicant: false,
        },
        "We received your application",
      ],
      [
        "NEW_APPLICATION",
        {
          schemaVersion: 1,
          applicantName: "Applicant",
          event: emailEvent,
          eventId: randomUUID(),
        },
        "A new application for your event",
      ],
      [
        "APPLICATION_APPROVED",
        { schemaVersion: 1, applicantName: "Applicant", event: emailEvent },
        "Your application is approved",
      ],
      [
        "APPLICATION_REJECTED",
        { schemaVersion: 1, applicantName: "Applicant" },
        "An update on your application",
      ],
      [
        "EVENT_CANCELLED",
        {
          schemaVersion: 1,
          applicantName: "Applicant",
          event: {
            title: emailEvent.title,
            startsAt: emailEvent.startsAt,
            endsAt: emailEvent.endsAt,
            timezone: "UTC",
          },
          cancellationReason: "Reason",
        },
        "Event cancelled",
      ],
    ] as const;

    for (const [type, payload, subject] of cases) {
      const message = await renderOutboxEmail(type, payload);
      assert.equal(message.subject, subject);
      check(
        message.html.includes("EVENT FLOW") &&
          message.text.includes("Event Flow"),
      );
    }

    await assert.rejects(renderOutboxEmail("MANUAL_EVENT_MESSAGE", manual));
    // Verify actual lock contention without persistent fixture data or stress.
    let unlockFirst: () => void = () => {};
    let firstReady: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      unlockFirst = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      firstReady = resolve;
    });
    const firstLock = prisma
      .$transaction(
        async (tx) => {
          await checkManualCommunicationAdmission(tx, {
            eventId: fixtureEventId,
            actorUserId: fixtureActorId,
            recipientCount: 0,
          });
          firstReady();
          await hold;
          throw rollback;
        },
        { isolationLevel: "ReadCommitted", timeout: 10000 },
      )
      .catch((error) => {
        assert.equal(error, rollback);
      });
    await ready;

    try {
      await prisma.$transaction(async (tx) => {
        const [lock] = await tx.$queryRaw<
          { acquired: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(27001, 1) AS acquired`;
        assert.equal(lock.acquired, false);
      });
    } finally {
      unlockFirst();
      await firstLock;
    }

    console.log(
      `Communications targeted verification passed (${checks} predicate checks plus equality/rejection assertions). All fixtures rolled back; no SMTP.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
