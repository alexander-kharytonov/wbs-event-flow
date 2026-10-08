// Real writers/Prisma/PostgreSQL, with transaction commits withheld by this
// script-only adapter. No server/dispatcher starts, all fixtures roll back.
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createRequire, Module } from "node:module";
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external";
import type { Prisma } from "@/generated/prisma/client";

async function main() {
  loadEnvConfig(process.cwd(), true);
  // Run with `node --import tsx`, not react-server: standalone next/navigation
  // needs normal React. Disable only the compile-time server-only marker here,
  // as a test runner does; no production module/identity function is mocked.
  const require = createRequire(`${process.cwd()}/package.json`);
  const guardPath = require.resolve("server-only");
  const guard = new Module(guardPath);
  guard.exports = {};
  guard.loaded = true;
  require.cache[guardPath] = guard;
  Object.assign(globalThis, { AsyncLocalStorage });
  const { getServerEnv } = await import("@/lib/env");
  const env = getServerEnv();
  const { PrismaClient } = await import("@/generated/prisma/client");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: [{ emit: "event", level: "query" }],
  });
  let outboxInserts = 0;
  db.$on("query", (event) => {
    // Count statements only. Never print SQL parameters or secret-bearing data.
    if (/^INSERT INTO .*"EmailOutbox"/.test(event.query)) {
      outboxInserts++;
    }
  });
  let activeTx: Prisma.TransactionClient | undefined;
  let failTrigger: string | undefined;
  const scope = globalThis as typeof globalThis & { prisma?: typeof db };
  assert.equal(scope.prisma, undefined, "Run this script in a fresh process.");
  // Production writers still execute their original transaction callbacks. Each
  // callback gets a real savepoint so failures undo its entire domain mutation;
  // the outer transaction always rolls back even if an assertion fails.
  scope.prisma = new Proxy(db, {
    get(_target, property) {
      assert.ok(activeTx, "No database access outside rollback-only scope.");
      const tx = activeTx;

      if (property === "$transaction") {
        return async <T>(
          writer: (client: Prisma.TransactionClient) => Promise<T>,
          options?: { isolationLevel?: string },
        ) => {
          assert.equal(options?.isolationLevel, "ReadCommitted");
          await tx.$executeRaw`SAVEPOINT writer_verification`;
          const writerTx = new Proxy(tx, {
            get(target, key) {
              if (key === "communication" && failTrigger) {
                return new Proxy(target.communication, {
                  get(model, operation) {
                    if (operation === "create") {
                      return async (args: Prisma.CommunicationCreateArgs) => {
                        if (args.data.trigger === failTrigger) {
                          failTrigger = undefined;
                          // A genuine SQL failure before enqueue must undo all
                          // preceding domain/Communication/Outbox writes.
                          await tx.$executeRaw`SELECT 1 / 0`;
                        }

                        return model.create(args);
                      };
                    }

                    return Reflect.get(model, operation);
                  },
                });
              }

              return Reflect.get(target, key);
            },
          });

          try {
            const result = await writer(writerTx);
            await tx.$executeRaw`RELEASE SAVEPOINT writer_verification`;

            return result;
          } catch (error) {
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT writer_verification`;
            await tx.$executeRaw`RELEASE SAVEPOINT writer_verification`;
            throw error;
          }
        };
      }

      const value = Reflect.get(tx, property);

      return typeof value === "function" ? value.bind(tx) : value;
    },
  });
  const rollback = new Error("Intentional transactional verification rollback");
  const ids = {
    owner: randomUUID(),
    organizer: randomUUID(),
    manager: randomUUID(),
    applicant: randomUUID(),
  };
  const eventIds: string[] = [];

  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          activeTx = tx;
          const { submitEventApplication } = await import(
            "@/features/events/server/submit-application"
          );
          const { reviewEventApplication } = await import(
            "@/features/events/server/review-application"
          );
          const { changeOwnedEventLifecycle } = await import(
            "@/features/events/server/event-lifecycle"
          );
          const { withdrawOwnApplication } = await import(
            "@/features/events/server/withdraw-application"
          );
          const { renderOutboxEmail } = await import(
            "@/lib/email-outbox/render"
          );
          const { transactionalEmailSubjects } = await import(
            "@/lib/email-outbox/payload"
          );
          const { transactionalContextSchema } = await import(
            "@/features/communications/server/contracts"
          );
          const { workAsyncStorage } = await import(
            "next/dist/server/app-render/work-async-storage.external"
          );
          const { workUnitAsyncStorage } = await import(
            "next/dist/server/app-render/work-unit-async-storage.external"
          );
          const { createRequestStore } = await import(
            "next/dist/server/async-storage/request-store"
          );
          const { auth } = await import("@/lib/auth");
          const { makeSignature } = await import("better-auth/crypto");
          const owner = await tx.user.create({
            data: {
              id: ids.owner,
              name: "Verification owner",
              email: `${ids.owner}@example.test`,
              emailVerified: true,
            },
          });
          await tx.organizerProfile.create({
            data: { id: ids.organizer, userId: owner.id },
          });
          const manager = await tx.user.create({
            data: {
              id: ids.manager,
              name: "Verification manager",
              email: `${ids.manager}@example.test`,
              emailVerified: true,
            },
          });
          const applicant = await tx.user.create({
            data: {
              id: ids.applicant,
              name: "Verification applicant",
              email: `${ids.applicant}@example.test`,
              emailVerified: true,
            },
          });
          const token = randomUUID();
          await tx.session.create({
            data: {
              userId: applicant.id,
              token,
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          const authContext = await auth.$context;
          const cookie = `${authContext.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, env.BETTER_AUTH_SECRET)}`)}`;

          async function request<T>(run: () => Promise<T>, signedIn = false) {
            const store = createRequestStore({
              phase: "action",
              headers: new Headers(signedIn ? { cookie } : {}),
              url: { pathname: "/verification" },
              rootParams: {},
              implicitTags: { tags: [], expirationsByCacheKind: new Map() },
              resumeDataCache: null,
              previewProps: undefined,
              isHmrRefresh: false,
              serverComponentsHmrCache: undefined,
              hmrRefreshHash: undefined,
              fallbackParams: null,
              onUpdateCookies: undefined,
            });

            return workAsyncStorage.run(
              {
                route: "/verification",
                isStaticGeneration: false,
              } as WorkStore,
              () => workUnitAsyncStorage.run(store, run),
            );
          }

          async function eventFixture() {
            const startsAt = new Date(Date.now() + 3600000);
            const endsAt = new Date(Date.now() + 7200000);
            const publicId = randomUUID();
            const event = await tx.event.create({
              data: {
                organizerId: ids.organizer,
                title: "Frozen verification event",
                startsAt,
                endsAt,
                timezone: "UTC",
                publicId,
                publishedAt: new Date(),
              },
            });
            eventIds.push(event.id);
            const snapshot = {
              schemaVersion: 2,
              title: event.title,
              description: null,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              timezone: "UTC",
              visibility: "PRIVATE",
              accountRequirement: "OPTIONAL",
              capacity: null,
              registrationOpensAt: null,
              registrationClosesAt: null,
              registrationForm: { fields: [] },
              maxGuestsPerRegistration: 10,
            };
            const revision = await tx.eventRevision.create({
              data: {
                eventId: event.id,
                number: 1,
                contentVersion: 1,
                snapshot,
                publishedAt: new Date(),
              },
            });
            await tx.event.update({
              where: { id: event.id },
              data: { publishedRevisionId: revision.id },
            });
            await tx.eventStaff.create({
              data: { eventId: event.id, userId: manager.id, role: "MANAGER" },
            });

            return { ...event, publicId, revision, snapshot };
          }

          async function applicationFixture(
            event: Awaited<ReturnType<typeof eventFixture>>,
            email: string,
            status: "PENDING" | "WITHDRAWN" | "REJECTED" = "PENDING",
          ) {
            return tx.application.create({
              data: {
                eventId: event.id,
                eventRevisionId: event.revision.id,
                email,
                fullName: "Frozen applicant",
                status,
              },
            });
          }

          const event = await eventFixture();
          const input = {
            publicId: event.publicId,
            eventRevisionId: event.revision.id,
            fullName: "Public applicant",
            email: " Public@Example.test ",
            answers: {},
          };
          assert.deepEqual(await request(() => submitEventApplication(input)), {
            success: true,
          });
          const submitted = await tx.application.findFirstOrThrow({
            where: { eventId: event.id, email: "public@example.test" },
          });
          const submissionHistory = await tx.communication.findMany({
            where: { eventId: event.id },
            include: { deliveries: true },
          });
          assert.equal(submissionHistory.length, 2);

          for (const trigger of [
            "APPLICATION_RECEIVED",
            "NEW_APPLICATION",
          ] as const) {
            const record = submissionHistory.find(
              (row) => row.trigger === trigger,
            );
            assert.ok(record);
            assert.equal(record.subject, transactionalEmailSubjects[trigger]);
            assert.equal(record.actorUserId, null);
            assert.equal(record.actorNameSnapshot, null);
            assert.equal(record.actorRoleSnapshot, null);
            assert.equal(record.recipientCount, 1);
            assert.equal(record.idempotencyKey, `${submitted.id}:${trigger}`);
            assert.equal(
              record.deliveries[0].deduplicationKey,
              `${submitted.id}:${trigger}`,
            );
            assert.equal(
              record.deliveries[0].recipientEmail,
              trigger === "NEW_APPLICATION" ? owner.email : submitted.email,
            );
            const emailEvent = {
              title: event.title,
              startsAt: event.snapshot.startsAt,
              endsAt: event.snapshot.endsAt,
              timezone: "UTC",
              publicId: event.publicId,
            };
            const expectedPayload = {
              schemaVersion: 1,
              applicantName: submitted.fullName,
              event: emailEvent,
              ...(trigger === "NEW_APPLICATION"
                ? { eventId: event.id }
                : { linkedApplicant: false }),
            };
            assert.deepEqual(record.deliveries[0].payload, expectedPayload);
            assert.deepEqual(
              await renderOutboxEmail(
                trigger,
                record.deliveries[0].payload,
                record.id,
              ),
              await renderOutboxEmail(trigger, expectedPayload, null),
            );
          }

          assert.deepEqual(await request(() => submitEventApplication(input)), {
            success: true,
          });
          assert.equal(
            await tx.communication.count({ where: { eventId: event.id } }),
            2,
          );
          // Linked reapply goes through real Better Auth session and withdrawal writer.
          const linkedInput = {
            ...input,
            fullName: applicant.name,
            email: "ignored@example.test",
          };
          assert.deepEqual(
            await request(() => submitEventApplication(linkedInput), true),
            { success: true },
          );
          const firstLinked = await tx.application.findFirstOrThrow({
            where: {
              eventId: event.id,
              userId: applicant.id,
              status: "PENDING",
            },
          });
          assert.equal(firstLinked.email, applicant.email);
          assert.equal(
            (
              await request(
                () =>
                  withdrawOwnApplication(applicant.id, {
                    publicId: event.publicId,
                    applicationId: firstLinked.id,
                  }),
                true,
              )
            ).success,
            true,
          );
          assert.deepEqual(
            await request(() => submitEventApplication(linkedInput), true),
            { success: true },
          );
          const reapplied = await tx.application.findFirstOrThrow({
            where: {
              eventId: event.id,
              userId: applicant.id,
              status: "PENDING",
            },
          });
          assert.notEqual(reapplied.id, firstLinked.id);
          assert.equal(
            await tx.communication.count({
              where: {
                eventId: event.id,
                idempotencyKey: { startsWith: `${reapplied.id}:` },
              },
            }),
            2,
          );
          const beforeFailure = await tx.communication.count({
            where: { eventId: event.id },
          });
          failTrigger = "NEW_APPLICATION";
          assert.equal(
            (
              await request(() =>
                submitEventApplication({
                  ...input,
                  email: "rollback@example.test",
                }),
              )
            ).success,
            undefined,
          );
          assert.equal(
            await tx.application.count({
              where: { eventId: event.id, email: "rollback@example.test" },
            }),
            0,
          );
          assert.equal(
            await tx.communication.count({ where: { eventId: event.id } }),
            beforeFailure,
          );

          assert.deepEqual(
            await reviewEventApplication(
              manager.id,
              { eventId: event.id, applicationId: submitted.id },
              "APPROVED",
            ),
            { success: true },
          );
          const approved = await tx.application.findUniqueOrThrow({
            where: { id: submitted.id },
          });
          assert.equal(approved.reviewedByUserId, manager.id);
          const registration = await tx.registration.findUniqueOrThrow({
            where: { sourceApplicationId: submitted.id },
            include: { attendees: { include: { ticket: true } } },
          });
          assert.equal(registration.attendees.length, 1);
          const primary = registration.attendees[0];
          assert.equal(primary.kind, "PRIMARY");
          assert.equal(primary.email, submitted.email);
          assert.deepEqual(primary.createdAt, approved.reviewedAt);
          assert.deepEqual(registration.createdAt, approved.reviewedAt);
          assert.ok(primary.ticket?.anonymousAccessEncrypted);
          const approval = await tx.communication.findFirstOrThrow({
            where: { eventId: event.id, trigger: "APPLICATION_APPROVED" },
            include: { deliveries: true },
          });
          assert.equal(approval.actorUserId, manager.id);
          assert.equal(approval.actorRoleSnapshot, "MANAGER");
          assert.equal(approval.actorNameSnapshot, manager.name);
          assert.equal(
            approval.deliveries[0].deduplicationKey,
            `${submitted.id}:APPLICATION_APPROVED`,
          );
          assert.equal(
            approval.idempotencyKey,
            `${submitted.id}:PENDING_TO_APPROVED:APPLICATION_APPROVED`,
          );
          assert.equal(
            approval.subject,
            transactionalEmailSubjects.APPLICATION_APPROVED,
          );
          const approvalMail = await renderOutboxEmail(
            "APPLICATION_APPROVED",
            approval.deliveries[0].payload,
            approval.id,
          );
          assert.ok(approvalMail.text.includes("/ticket/"));
          assert.deepEqual(
            approvalMail,
            await renderOutboxEmail(
              "APPLICATION_APPROVED",
              approval.deliveries[0].payload,
            ),
          );
          assert.equal(
            (
              await reviewEventApplication(
                manager.id,
                { eventId: event.id, applicationId: submitted.id },
                "APPROVED",
              )
            ).code,
            "ALREADY_REVIEWED",
          );
          assert.equal(
            await tx.communication.count({
              where: { eventId: event.id, trigger: "APPLICATION_APPROVED" },
            }),
            1,
          );
          const reviewFailure = await applicationFixture(
            event,
            "review-failure@example.test",
          );
          failTrigger = "APPLICATION_APPROVED";
          assert.equal(
            (
              await reviewEventApplication(
                manager.id,
                { eventId: event.id, applicationId: reviewFailure.id },
                "APPROVED",
              )
            ).code,
            "FAILED",
          );
          assert.equal(
            (
              await tx.application.findUniqueOrThrow({
                where: { id: reviewFailure.id },
              })
            ).status,
            "PENDING",
          );
          assert.equal(
            await tx.registration.count({
              where: { sourceApplicationId: reviewFailure.id },
            }),
            0,
          );

          const normalRejection = await applicationFixture(
            event,
            "normal-reject@example.test",
          );
          assert.deepEqual(
            await reviewEventApplication(
              manager.id,
              {
                eventId: event.id,
                applicationId: normalRejection.id,
              },
              "REJECTED",
            ),
            { success: true },
          );
          const normalHistory = await tx.communication.findUniqueOrThrow({
            where: {
              eventId_idempotencyKey: {
                eventId: event.id,
                idempotencyKey: `${normalRejection.id}:PENDING_TO_REJECTED:APPLICATION_REJECTED`,
              },
            },
            include: { deliveries: true },
          });
          assert.deepEqual(normalHistory.contextSnapshot, {
            schemaVersion: 1,
            kind: "TRANSACTIONAL",
            trigger: "APPLICATION_REJECTED",
            eventTitle: event.title,
          });
          assert.deepEqual(normalHistory.deliveries[0].payload, {
            schemaVersion: 1,
            applicantName: normalRejection.fullName,
            eventTitle: event.title,
            publicId: event.publicId,
          });
          assert.deepEqual(
            await renderOutboxEmail(
              "APPLICATION_REJECTED",
              normalHistory.deliveries[0].payload,
              normalHistory.id,
            ),
            await renderOutboxEmail(
              "APPLICATION_REJECTED",
              normalHistory.deliveries[0].payload,
            ),
          );

          const rejectionEvent = await eventFixture();
          const rejected = await applicationFixture(
            rejectionEvent,
            "reject@example.test",
          );
          await tx.eventRevision.update({
            where: { id: rejectionEvent.revision.id },
            data: { snapshot: { damaged: true } },
          });
          assert.deepEqual(
            await reviewEventApplication(
              manager.id,
              { eventId: rejectionEvent.id, applicationId: rejected.id },
              "REJECTED",
            ),
            { success: true },
          );
          const rejection = await tx.communication.findFirstOrThrow({
            where: { eventId: rejectionEvent.id },
            include: { deliveries: true },
          });
          assert.deepEqual(rejection.contextSnapshot, {
            schemaVersion: 1,
            kind: "TRANSACTIONAL",
            trigger: "APPLICATION_REJECTED",
          });
          assert.deepEqual(rejection.deliveries[0].payload, {
            schemaVersion: 1,
            applicantName: rejected.fullName,
            publicId: rejectionEvent.publicId,
          });
          assert.equal(
            rejection.subject,
            transactionalEmailSubjects.APPLICATION_REJECTED,
          );
          assert.equal(rejection.actorUserId, manager.id);
          assert.equal(
            (
              await tx.application.findUniqueOrThrow({
                where: { id: rejected.id },
              })
            ).reviewedByUserId,
            manager.id,
          );
          assert.equal(
            (
              await reviewEventApplication(
                manager.id,
                { eventId: rejectionEvent.id, applicationId: rejected.id },
                "REJECTED",
              )
            ).code,
            "ALREADY_REVIEWED",
          );

          // Cancellation includes only pending + active Registration contacts, with
          // existing normalized dedup and winner order; never Guest/Staff contacts.
          await applicationFixture(event, "duplicate@example.test");
          await applicationFixture(event, " DUPLICATE@EXAMPLE.TEST ");
          await applicationFixture(
            event,
            "withdrawn@example.test",
            "WITHDRAWN",
          );
          await applicationFixture(event, "rejected@example.test", "REJECTED");
          await tx.attendee.create({
            data: {
              registrationId: registration.id,
              kind: "GUEST",
              name: "Guest",
              email: "guest@example.test",
            },
          });
          const revokedApplication = await applicationFixture(
            event,
            "revoked@example.test",
          );
          assert.deepEqual(
            await reviewEventApplication(
              manager.id,
              { eventId: event.id, applicationId: revokedApplication.id },
              "APPROVED",
            ),
            { success: true },
          );
          const revoked = await tx.registration.findUniqueOrThrow({
            where: { sourceApplicationId: revokedApplication.id },
          });
          await tx.registration.update({
            where: { id: revoked.id },
            data: { revokedAt: new Date() },
          });
          const pending = await tx.application.findMany({
            where: { eventId: event.id, status: "PENDING" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { email: true, fullName: true },
          });
          const active = await tx.registration.findMany({
            where: { eventId: event.id, revokedAt: null },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { attendeeEmail: true, attendeeName: true },
          });
          const expectedRecipients = new Map<string, string>();

          for (const person of [
            ...pending,
            ...active.map((row) => ({
              email: row.attendeeEmail,
              fullName: row.attendeeName,
            })),
          ]) {
            const email = person.email.trim().toLowerCase();

            if (!expectedRecipients.has(email)) {
              expectedRecipients.set(email, person.fullName);
            }
          }

          const insertsBeforeCancel = outboxInserts;
          assert.deepEqual(
            await changeOwnedEventLifecycle(ids.organizer, {
              eventId: event.id,
              action: "cancel",
              reason: "Frozen reason",
            }),
            { success: true },
          );
          assert.equal(
            outboxInserts - insertsBeforeCancel,
            1,
            "Cancellation must batch recipient inserts.",
          );
          const cancellation = await tx.communication.findFirstOrThrow({
            where: { eventId: event.id, trigger: "EVENT_CANCELLED" },
            include: { deliveries: true },
          });
          assert.equal(cancellation.recipientCount, expectedRecipients.size);
          assert.equal(
            cancellation.idempotencyKey,
            `${event.id}:EVENT_CANCELLED`,
          );
          assert.equal(cancellation.actorUserId, owner.id);
          assert.equal(cancellation.actorRoleSnapshot, "OWNER");
          assert.deepEqual(
            cancellation.deliveries.map((row) => row.recipientEmail).sort(),
            [...expectedRecipients.keys()].sort(),
          );

          for (const delivery of cancellation.deliveries) {
            assert.equal(
              delivery.deduplicationKey,
              `${event.id}:EVENT_CANCELLED:${delivery.recipientEmail}`,
            );
            assert.deepEqual(delivery.payload, {
              schemaVersion: 1,
              applicantName: expectedRecipients.get(delivery.recipientEmail),
              event: {
                title: event.title,
                startsAt: event.snapshot.startsAt,
                endsAt: event.snapshot.endsAt,
                timezone: "UTC",
              },
              cancellationReason: "Frozen reason",
              publicId: event.publicId,
            });
            assert.deepEqual(
              await renderOutboxEmail(
                delivery.type,
                delivery.payload,
                cancellation.id,
              ),
              await renderOutboxEmail(delivery.type, delivery.payload),
            );
          }

          assert.equal(
            (
              await changeOwnedEventLifecycle(ids.organizer, {
                eventId: event.id,
                action: "cancel",
                reason: "Again",
              })
            ).success,
            undefined,
          );
          assert.deepEqual(
            await changeOwnedEventLifecycle(ids.organizer, {
              eventId: event.id,
              action: "archive",
            }),
            { success: true },
          );
          assert.deepEqual(
            await changeOwnedEventLifecycle(ids.organizer, {
              eventId: event.id,
              action: "restore",
            }),
            { success: true },
          );
          assert.equal(
            (
              await changeOwnedEventLifecycle(ids.organizer, {
                eventId: event.id,
                action: "cancel",
                reason: "After restore",
              })
            ).success,
            undefined,
          );
          assert.equal(
            await tx.communication.count({
              where: { eventId: event.id, trigger: "EVENT_CANCELLED" },
            }),
            1,
          );
          const afterCancelMail = await renderOutboxEmail(
            "APPLICATION_APPROVED",
            approval.deliveries[0].payload,
            approval.id,
          );
          assert.ok(!afterCancelMail.text.includes("/ticket/"));
          const emptyEvent = await eventFixture();
          assert.deepEqual(
            await changeOwnedEventLifecycle(ids.organizer, {
              eventId: emptyEvent.id,
              action: "cancel",
              reason: "No recipients",
            }),
            { success: true },
          );
          const empty = await tx.communication.findFirstOrThrow({
            where: { eventId: emptyEvent.id },
            include: { deliveries: true },
          });
          assert.equal(empty.recipientCount, 0);
          assert.equal(empty.deliveries.length, 0);
          const failEvent = await eventFixture();
          await applicationFixture(failEvent, "cancel-failure@example.test");
          failTrigger = "EVENT_CANCELLED";
          assert.equal(
            (
              await changeOwnedEventLifecycle(ids.organizer, {
                eventId: failEvent.id,
                action: "cancel",
                reason: "Must roll back",
              })
            ).success,
            undefined,
          );
          assert.equal(
            (await tx.event.findUniqueOrThrow({ where: { id: failEvent.id } }))
              .cancelledAt,
            null,
          );
          assert.equal(
            await tx.communication.count({ where: { eventId: failEvent.id } }),
            0,
          );

          // Bounded regression beyond the MANUAL limit, not a stress campaign.
          const largeEvent = await eventFixture();
          await tx.application.createMany({
            data: Array.from({ length: 1001 }, (_, index) => ({
              eventId: largeEvent.id,
              eventRevisionId: largeEvent.revision.id,
              fullName: "Batch verification",
              email: `batch-${index}@example.test`,
            })),
          });
          const largeBatchBefore = outboxInserts;
          assert.deepEqual(
            await changeOwnedEventLifecycle(ids.organizer, {
              eventId: largeEvent.id,
              action: "cancel",
              reason: "Transactional limit regression",
            }),
            { success: true },
          );
          assert.equal(outboxInserts - largeBatchBefore, 1);
          const largeHistory = await tx.communication.findFirstOrThrow({
            where: { eventId: largeEvent.id },
            select: {
              recipientCount: true,
              _count: { select: { deliveries: true } },
            },
          });
          assert.equal(largeHistory.recipientCount, 1001);
          assert.equal(largeHistory._count.deliveries, 1001);
          assert.equal(
            await tx.communication.count({ where: { eventId: largeEvent.id } }),
            1,
          );

          const history = await tx.communication.findMany({
            where: { eventId: { in: eventIds } },
            select: { contextSnapshot: true, message: true, audience: true },
          });

          for (const row of history) {
            transactionalContextSchema.parse(row.contextSnapshot);
            assert.equal(row.message, null);
            assert.equal(row.audience, null);
            assert.ok(
              !/ticket|credential|anonymous|applicantName|email|answers|token/i.test(
                JSON.stringify(row.contextSnapshot),
              ),
            );
          }

          await tx.eventStaff.deleteMany({ where: { userId: manager.id } });
          await tx.user.delete({ where: { id: manager.id } });
          const retained = await tx.communication.findUniqueOrThrow({
            where: { id: approval.id },
          });
          assert.equal(retained.actorUserId, null);
          assert.equal(retained.actorNameSnapshot, manager.name);
          assert.equal(retained.actorRoleSnapshot, "MANAGER");
          throw rollback;
        },
        { isolationLevel: "ReadCommitted", timeout: 60000 },
      ),
      (error) => error === rollback,
    );
    activeTx = undefined;
    assert.equal(await db.event.count({ where: { id: { in: eventIds } } }), 0);
    assert.equal(
      await db.user.count({
        where: { id: { in: [ids.owner, ids.manager, ids.applicant] } },
      }),
      0,
    );
    assert.equal(
      await db.organizerProfile.count({ where: { id: ids.organizer } }),
      0,
    );
    assert.equal(
      await db.communication.count({ where: { eventId: { in: eventIds } } }),
      0,
    );
    console.log(
      "27B targeted verification passed: real submission/reapply/review/cancellation, exact intents, anonymous Ticket rendering, SQL-failure rollback, grouped batch delivery, privacy. All fixtures rolled back; no SMTP.",
    );
  } finally {
    activeTx = undefined;
    delete scope.prisma;
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Never log Prisma query arguments, session cookies, Ticket data or mail text.
  console.error(
    "27B verification failed; all transaction fixtures rolled back.",
  );
  const failure =
    error instanceof Error && "actual" in error && error.actual instanceof Error
      ? error.actual
      : error;

  if (failure instanceof Error) {
    console.error(failure.name, "code" in failure ? failure.code : "");
    // Stack locations only, never the error message/values or query arguments.
    const locations = failure.stack
      ?.split("\n")
      .filter((line) => line.trim().startsWith("at "));
    console.error(locations?.join("\n") ?? failure.name);
  }

  process.exitCode = 1;
});
