import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import nextEnv from "@next/env";
import pg from "pg";

// Run with: pnpm test:guest-persistence
// Uses only a fresh local database; never applies migrations to DATABASE_URL itself.
nextEnv.loadEnvConfig(process.cwd(), true);
const source = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(source.hostname));
const database = `guest2_regression_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Client({ connectionString: source.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${database}"`);
source.pathname = `/${database}`;
process.env.DATABASE_URL = source.toString();
let disconnect: (() => Promise<void>) | undefined;
let checks = 0;
function check(value: unknown) {
  assert.ok(value);
  checks++;
}
function run(args: string[], expected = 0) {
  const result = spawnSync(args[0], args.slice(1), {
    env: process.env,
    encoding: "utf8",
  });
  assert.equal(result.status, expected, result.stdout + result.stderr);

  return result.stdout + result.stderr;
}
try {
  run(["pnpm", "exec", "prisma", "migrate", "deploy"]);
  run(["pnpm", "exec", "prisma", "migrate", "status"]);
  run([
    "pnpm",
    "exec",
    "prisma",
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--exit-code",
  ]);
  const { prisma } = await import("../lib/prisma");
  disconnect = () => prisma.$disconnect();
  const { updateGuestPolicy } = await import(
    "../features/events/server/guest-policy"
  );
  const { mutateRegistrationForm, getRegistrationForm } = await import(
    "../features/events/server/registration-form"
  );
  const { publishOwnedEvent } = await import(
    "../features/events/server/publish-event"
  );
  const { eventSnapshotSchema } = await import(
    "../features/events/schemas/event-snapshot"
  );
  const { readEventTemplate } = await import(
    "../features/exports/server/event-template"
  );
  const { createTemplateEvent } = await import(
    "../features/events/server/create-template-event"
  );
  const { applicationAnswersSchema } = await import(
    "../features/events/application-input"
  );
  const owner = await prisma.user.create({
    data: {
      name: "Regression owner",
      email: `${database}@example.invalid`,
      emailVerified: true,
      organizerProfile: { create: {} },
    },
    include: { organizerProfile: true },
  });
  assert.ok(owner.organizerProfile);
  const organizerId = owner.organizerProfile.id;
  const event = await prisma.event.create({
    data: {
      organizerId,
      title: "Guest persistence regression",
      language: "en",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 172800000),
      timezone: "Europe/Berlin",
      maxGuestsPerRegistration: 2,
      registrationForm: { create: {} },
    },
  });
  check(event.guestPolicy === "FLEXIBLE");
  check(
    (
      await updateGuestPolicy(randomUUID(), {
        eventId: event.id,
        version: event.updatedAt.toISOString(),
        guestPolicy: "APPROVAL_REQUIRED",
      })
    ).code === "UNAVAILABLE",
  );
  check(
    (
      await updateGuestPolicy(owner.id, {
        eventId: event.id,
        version: event.updatedAt.toISOString(),
        guestPolicy: "APPROVAL_REQUIRED",
      })
    ).code === "SAVED",
  );
  check(
    (
      await updateGuestPolicy(owner.id, {
        eventId: event.id,
        version: event.updatedAt.toISOString(),
        guestPolicy: "FLEXIBLE",
      })
    ).code === "CONFLICT",
  );
  async function add(
    subject: "GUEST" | "APPLICANT",
    label: string,
    type: "SHORT_TEXT" | "SINGLE_CHOICE",
  ) {
    const form = await getRegistrationForm(event.id, organizerId, subject);
    assert.ok(form);
    const result = await mutateRegistrationForm(
      organizerId,
      {
        eventId: event.id,
        version: form.form.version,
        kind: "add",
        field: {
          label,
          type,
          required: true,
          ...(type === "SINGLE_CHOICE"
            ? { options: [{ label: "One" }, { label: "Two" }] }
            : {}),
        },
      },
      subject,
    );
    check(!!result.form);
    assert.ok(result.form);

    return result.form;
  }
  const applicant = await add("APPLICANT", "Applicant only", "SHORT_TEXT");
  const guest = await add("GUEST", "Guest choice", "SINGLE_CHOICE");
  check(applicant.fields.length === 1 && guest.fields.length === 1);
  const crossSubject = await mutateRegistrationForm(
    organizerId,
    {
      eventId: event.id,
      version: guest.version,
      kind: "delete",
      fieldId: applicant.fields[0].id,
    },
    "GUEST",
  );
  check(!crossSubject.form);
  const current = await prisma.event.findUniqueOrThrow({
    where: { id: event.id },
  });
  check(
    (
      await updateGuestPolicy(owner.id, {
        eventId: event.id,
        version: current.updatedAt.toISOString(),
        guestPolicy: "FLEXIBLE",
      })
    ).code === "GUEST_FIELDS_EXIST",
  );
  check(
    !(
      await publishOwnedEvent(randomUUID(), {
        eventId: event.id,
        contentVersion: current.contentVersion,
      })
    ).success,
  );
  check(
    (
      await publishOwnedEvent(organizerId, {
        eventId: event.id,
        contentVersion: current.contentVersion,
      })
    ).success,
  );
  const published = await prisma.event.findUniqueOrThrow({
    where: { id: event.id },
    include: { publishedRevision: true },
  });
  assert.ok(published.publishedRevision);
  assert.ok(published.publishedRevisionId);
  // Only the request-session boundary is mocked; all persistence and locking are real.
  mock.module("../lib/session.ts", {
    namedExports: { getSession: async () => null },
  });
  const { submitEventApplication } = await import(
    "../features/events/server/submit-application"
  );
  const blocked = await submitEventApplication({
    publicId: published.publicId,
    eventRevisionId: published.publishedRevisionId,
    fullName: "Not admitted",
    email: "blocked@example.invalid",
    answers: {},
  });
  check(blocked.message?.code === "formUnavailable");
  check(
    (await prisma.application.count({ where: { eventId: event.id } })) === 0,
  );
  const frozen = JSON.stringify(published.publishedRevision.snapshot);
  const snapshot = eventSnapshotSchema.parse(
    published.publishedRevision.snapshot,
  );
  check(
    snapshot.guestPolicy === "APPROVAL_REQUIRED" &&
      snapshot.guestForm.fields.length === 1 &&
      snapshot.registrationForm.fields.length === 1,
  );
  const { guestPolicy: _policy, ...missingPolicy } = snapshot;
  check(!eventSnapshotSchema.safeParse(missingPolicy).success);
  const { guestForm: _guestForm, ...missingForm } = snapshot;
  check(!eventSnapshotSchema.safeParse(missingForm).success);
  check(
    !eventSnapshotSchema.safeParse({ ...snapshot, guestPolicy: "FLEXIBLE" })
      .success,
  );
  const template = await readEventTemplate(owner.id, event.id);
  check(template?.event.guestPolicy === "APPROVAL_REQUIRED");
  check(
    template?.event.registrationForm.fields.some(
      (field) => field.subject === "GUEST",
    ),
  );
  check((await readEventTemplate(randomUUID(), event.id)) === null);
  const clone = await createTemplateEvent(owner.id, organizerId, template);
  check(clone.success);
  assert.ok(clone.success);
  const copied = await readEventTemplate(owner.id, clone.eventId);
  assert.deepEqual(copied, template);
  checks++;
  const cloneFields = await prisma.registrationField.findMany({
    where: { form: { eventId: clone.eventId } },
  });
  check(
    cloneFields.every(
      (field) =>
        field.id !== guest.fields[0].id && field.id !== applicant.fields[0].id,
    ),
  );
  check(
    (await prisma.application.count({ where: { eventId: clone.eventId } })) ===
      0,
  );
  const guestField = snapshot.guestForm.fields[0];
  const values = { [guestField.id]: [guestField.options[0].id] };
  const answers = applicationAnswersSchema({
    registrationForm: snapshot.guestForm,
  }).parse(values);
  check(
    !applicationAnswersSchema({
      registrationForm: snapshot.guestForm,
    }).safeParse({ [applicant.fields[0].id]: ["wrong subject"] }).success,
  );
  // Submission and policy mutation serialize on the same Event row.
  const race = await prisma.event.create({
    data: {
      organizerId,
      title: "Policy lock race",
      language: "en",
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      registrationForm: { create: {} },
    },
  });
  check(
    (
      await publishOwnedEvent(organizerId, {
        eventId: race.id,
        contentVersion: race.contentVersion,
      })
    ).success,
  );
  const racePublished = await prisma.event.findUniqueOrThrow({
    where: { id: race.id },
  });
  assert.ok(racePublished.publishedRevisionId);
  const raceRevisionId = racePublished.publishedRevisionId;
  let releaseLock = () => {};
  let acquiredLock = () => {};
  const acquired = new Promise<void>((resolve) => {
    acquiredLock = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const submission = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${race.id}::uuid FOR UPDATE`;
    acquiredLock();
    await released;
    await tx.application.create({
      data: {
        eventId: race.id,
        eventRevisionId: raceRevisionId,
        fullName: "Race applicant",
        email: "race@example.invalid",
      },
    });
  });
  await acquired;
  const policyChange = updateGuestPolicy(owner.id, {
    eventId: race.id,
    version: race.updatedAt.toISOString(),
    guestPolicy: "APPROVAL_REQUIRED",
  });
  releaseLock();
  await submission;
  check((await policyChange).code === "POLICY_LOCKED");
  const flexibleSubmission = await submitEventApplication({
    publicId: racePublished.publicId,
    eventRevisionId: raceRevisionId,
    fullName: "Flexible applicant",
    email: "flexible@example.invalid",
    answers: {},
  });
  check(flexibleSubmission.success === true);

  check(
    !(
      await mutateRegistrationForm(
        organizerId,
        {
          eventId: race.id,
          version: (
            await getRegistrationForm(race.id, organizerId)
          )?.form.version,
          kind: "add",
          field: {
            label: "Forbidden guest field",
            type: "SHORT_TEXT",
            required: false,
          },
        },
        "GUEST",
      )
    ).form,
  );
  const application = await prisma.application.create({
    data: {
      eventId: event.id,
      eventRevisionId: published.publishedRevisionId,
      fullName: "Submitted primary",
      email: "primary@example.invalid",
      guests: {
        create: {
          position: 0,
          name: "Submitted guest",
          answers: { create: Object.values(answers) },
        },
      },
    },
    include: {
      guests: { include: { answers: { include: { selectedOptions: true } } } },
    },
  });
  check(
    application.guests[0].answers[0].selectedOptions[0].optionId ===
      guestField.options[0].id,
  );
  check(
    (
      await updateGuestPolicy(owner.id, {
        eventId: event.id,
        version: current.updatedAt.toISOString(),
        guestPolicy: "FLEXIBLE",
      })
    ).code === "POLICY_LOCKED",
  );
  await prisma.application.update({
    where: { id: application.id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });
  check(
    (
      await updateGuestPolicy(owner.id, {
        eventId: event.id,
        version: current.updatedAt.toISOString(),
        guestPolicy: "FLEXIBLE",
      })
    ).code === "POLICY_LOCKED",
  );
  await assert.rejects(
    prisma.applicationGuest.create({
      data: { applicationId: application.id, position: 0, name: "Duplicate" },
    }),
  );
  checks++;
  await assert.rejects(
    prisma.applicationGuestAnswer.create({
      data: {
        applicationGuestId: application.guests[0].id,
        fieldId: guestField.id,
      },
    }),
  );
  checks++;
  // Exercise provenance in a rolled-back transaction, without implementing admission.
  const rollback = new Error("rollback regression");
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const registration = await tx.registration.create({
        data: {
          eventId: event.id,
          sourceApplicationId: application.id,
          attendeeName: application.fullName,
          attendeeEmail: application.email,
        },
      });
      const person = await tx.attendee.create({
        data: {
          registrationId: registration.id,
          kind: "GUEST",
          name: "Submitted guest",
          applicationGuestId: application.guests[0].id,
          applicationGuestApplicationId: application.id,
        },
      });
      check(person.applicationGuestId === application.guests[0].id);
      throw rollback;
    }),
    (error) => error === rollback,
  );
  check((await prisma.registration.count()) === 0);
  async function invalidProvenance(
    kind: "PRIMARY" | "GUEST",
    sourceId: string | null,
  ) {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const registration = await tx.registration.create({
          data: {
            eventId: event.id,
            sourceApplicationId: application.id,
            attendeeName: application.fullName,
            attendeeEmail: application.email,
          },
        });
        await tx.attendee.create({
          data: {
            registrationId: registration.id,
            kind,
            name: "Invalid",
            applicationGuestId: application.guests[0].id,
            applicationGuestApplicationId: sourceId,
          },
        });
      }),
    );
    checks++;
  }
  await invalidProvenance("PRIMARY", application.id);
  await invalidProvenance("GUEST", null);
  await invalidProvenance("GUEST", randomUUID());
  // Two real applications in the same Event still cannot share a declaration.
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const other = await tx.application.create({
        data: {
          eventId: event.id,
          eventRevisionId: application.eventRevisionId,
          fullName: "Other applicant",
          email: "other@example.invalid",
        },
      });
      const registration = await tx.registration.create({
        data: {
          eventId: event.id,
          sourceApplicationId: other.id,
          attendeeName: other.fullName,
          attendeeEmail: other.email,
        },
      });
      await tx.attendee.create({
        data: {
          registrationId: registration.id,
          kind: "GUEST",
          name: "Submitted guest",
          applicationGuestId: application.guests[0].id,
          applicationGuestApplicationId: application.id,
        },
      });
    }),
  );
  checks++;

  const form = await getRegistrationForm(event.id, organizerId, "GUEST");
  assert.ok(form);
  check(
    !!(
      await mutateRegistrationForm(
        organizerId,
        {
          eventId: event.id,
          version: form.form.version,
          kind: "delete",
          fieldId: guestField.id,
        },
        "GUEST",
      )
    ).form,
  );
  check(
    JSON.stringify(
      (
        await prisma.eventRevision.findUniqueOrThrow({
          where: { id: published.publishedRevisionId },
        })
      ).snapshot,
    ) === frozen,
  );
  check((await prisma.applicationGuestAnswer.count()) === 1);
  const revisedEvent = await prisma.event.findUniqueOrThrow({
    where: { id: event.id },
  });
  check(
    (
      await publishOwnedEvent(organizerId, {
        eventId: event.id,
        contentVersion: revisedEvent.contentVersion,
      })
    ).success,
  );
  const revised = await prisma.event.findUniqueOrThrow({
    where: { id: event.id },
    include: { publishedRevision: true },
  });
  check(
    eventSnapshotSchema.parse(revised.publishedRevision?.snapshot).guestForm
      .fields.length === 0,
  );
  check(
    JSON.stringify(
      (
        await prisma.eventRevision.findUniqueOrThrow({
          where: { id: application.eventRevisionId },
        })
      ).snapshot,
    ) === frozen,
  );

  check(
    run(["pnpm", "db:check"]).includes(
      "Database domain integrity checks passed",
    ),
  );
  await prisma.applicationGuestAnswerOption.updateMany({
    data: { optionId: randomUUID() },
  });
  check(run(["pnpm", "db:check"], 1).includes("guest_declaration_answers"));
  console.log(
    `GUEST-2: ${checks} focused assertions passed; empty migration replay, schema drift, populated integrity and corrupt-answer detection passed.`,
  );
} finally {
  await disconnect?.();
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
