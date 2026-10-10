// Explicitly requested 29B verification. Every DB write is in a disposable database.

import assert from "node:assert/strict";
import { ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { chmod, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import sharp from "sharp";
import {
  defaultBadgeLayout,
  readBadgeLayout,
} from "@/features/badges/badge-layout";
import {
  eventDateSource,
  eventFormValues,
  parseEventEdit,
} from "@/features/events/event-form-values";
import {
  eventInputSchema,
  eventValidationError,
  parseEventWithPreservedDates,
} from "@/features/events/event-input-schema";
import {
  canonicalizeReview,
  parseTemplateText,
  templateCreateInput,
  templateEventValues,
  validateTemplateCreate,
} from "@/features/events/import/template-input";
import {
  type EventTemplateV1,
  type EventTemplateV2,
  eventTemplateV1Schema,
  eventTemplateV2Schema,
  serializeEventTemplate,
  TEMPLATE_V1_LIMITS,
} from "@/features/exports/event-template";

function childTerminated(child: ChildProcess) {
  return child.exitCode !== null || child.signalCode !== null;
}

function terminateChild(
  child: ChildProcess,
  signal: NodeJS.Signals,
  timeoutMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.off("exit", exited);
      child.off("close", exited);
      child.off("error", failed);

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const exited = () => finish();
    const failed = (error: Error) => finish(error);
    child.once("exit", exited);
    child.once("close", exited);
    child.once("error", failed);
    timer = setTimeout(
      () => finish(new Error(`Child did not terminate after ${signal}`)),
      timeoutMs,
    );

    if (childTerminated(child)) {
      finish();

      return;
    }

    try {
      if (!child.kill(signal) && !childTerminated(child)) {
        finish(new Error(`Could not send ${signal} to verification child`));
      }
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function stopVerificationChild(child: ChildProcess, timeoutMs = 5000) {
  if (childTerminated(child)) {
    return;
  }

  try {
    await terminateChild(child, "SIGTERM", timeoutMs);
  } catch (first) {
    try {
      await terminateChild(child, "SIGKILL", timeoutMs);
    } catch (last) {
      throw new AggregateError(
        [first, last],
        "Verification child termination failed",
        { cause: first },
      );
    }
  }
}

// Every step gets its own attempt and deadline; rejected late promises are observed.
async function finishVerification(
  failures: unknown[],
  steps: { name: string; run: () => Promise<unknown> }[],
  timeoutMs = 15000,
) {
  const errors = [...failures];

  for (const step of steps) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        Promise.resolve().then(step.run),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Cleanup timed out: ${step.name}`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      errors.push(new Error(`Cleanup failed: ${step.name}`, { cause: error }));
    } finally {
      clearTimeout(timer);
    }
  }

  if (errors.length) {
    throw new AggregateError(
      errors,
      "Verification failed; all cleanup steps attempted",
      { cause: errors[0] },
    );
  }
}

function waitForBrowser(child: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      process.stdin.off("data", done);
      child.off("exit", stopped);
      child.off("close", stopped);
      child.off("error", failed);
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      process.stdin.pause();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const done = () => finish();
    const stopped = () =>
      finish(
        child.exitCode === 0
          ? undefined
          : new Error(
              `Browser server terminated: ${child.signalCode ?? child.exitCode}`,
            ),
      );
    const failed = (error: Error) => finish(error);
    const interrupted = () =>
      finish(new Error("Browser verification interrupted"));
    process.stdin.once("data", done);
    child.once("exit", stopped);
    child.once("close", stopped);
    child.once("error", failed);
    process.once("SIGINT", interrupted);
    process.once("SIGTERM", interrupted);
    process.stdin.resume();

    if (childTerminated(child)) {
      stopped();
    }
  });
}

async function checkCleanup() {
  const normal = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await once(normal, "exit");
  await stopVerificationChild(normal, 100);
  await waitForBrowser(normal);
  const signalled = spawn(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { stdio: "ignore" },
  );
  const exited = once(signalled, "exit");
  signalled.kill("SIGTERM");
  await exited;
  assert.equal(signalled.signalCode, "SIGTERM");
  assert.equal(signalled.exitCode, null);
  await stopVerificationChild(signalled, 100);
  await assert.rejects(waitForBrowser(signalled), /SIGTERM/);
  const running = spawn(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { stdio: "ignore" },
  );
  await stopVerificationChild(running, 1000);
  assert.ok(childTerminated(running));

  for (const event of ["exit", "close"]) {
    const racing = new ChildProcess();
    racing.kill = () => {
      racing.emit(event, 0, null);

      return true;
    };
    await stopVerificationChild(racing, 20);
    assert.equal(racing.listenerCount(event), 0);
  }
  const failed = new ChildProcess();
  failed.kill = () => false;
  await assert.rejects(stopVerificationChild(failed, 20), AggregateError);
  const throws = new ChildProcess();
  throws.kill = () => {
    throw new Error("kill failed");
  };
  await assert.rejects(stopVerificationChild(throws, 20), AggregateError);
  const emittedError = new ChildProcess();
  emittedError.kill = () => {
    emittedError.emit("error", new Error("child error"));

    return false;
  };
  await assert.rejects(stopVerificationChild(emittedError, 20), AggregateError);
  let signals = 0;
  const fallback = new ChildProcess();
  fallback.kill = () => {
    if (++signals === 2) {
      fallback.emit("exit", null, "SIGKILL");

      return true;
    }

    return false;
  };
  await stopVerificationChild(fallback, 20);
  assert.equal(signals, 2);
  const hangs = new ChildProcess();
  hangs.kill = () => true;
  await assert.rejects(stopVerificationChild(hangs, 20), AggregateError);
  assert.equal(hangs.listenerCount("exit"), 0);
  assert.equal(hangs.listenerCount("close"), 0);
  assert.equal(hangs.listenerCount("error"), 0);

  const original = new Error("Original assertion failure");
  const attempted: string[] = [];
  await assert.rejects(
    finishVerification(
      [original],
      [
        { name: "child", run: () => stopVerificationChild(failed, 20) },
        {
          name: "disconnect",
          run: async () => {
            attempted.push("disconnect");
            throw new Error("disconnect failed");
          },
        },
        {
          name: "drop verification DB",
          run: async () => {
            attempted.push("drop");
            throw new Error("drop failed");
          },
        },
        {
          name: "media",
          run: async () => {
            attempted.push("media");
            throw new Error("media removal failed");
          },
        },
      ],
      100,
    ),
    (error: unknown) =>
      error instanceof AggregateError &&
      error.cause === original &&
      error.errors.length === 5,
  );
  assert.deepEqual(attempted, ["disconnect", "drop", "media"]);
  let afterTimeout = false;
  await assert.rejects(
    finishVerification(
      [],
      [
        { name: "hang", run: () => new Promise(() => {}) },
        {
          name: "next",
          run: async () => {
            afterTimeout = true;
          },
        },
      ],
      20,
    ),
  );
  assert.equal(afterTimeout, true);
  await finishVerification([], [{ name: "success", run: async () => {} }]);
  console.log(
    "PASS: normal/signal/already-exited children, exit/close races, termination failure/timeouts, independent cleanup and original failure retained",
  );
}

// Real, schema-valid Unicode JSON; byte differences are content, not padding or invalid syntax.
function boundaryTemplate(
  seed: EventTemplateV1 | EventTemplateV2,
  bytes: number,
) {
  const template = structuredClone(seed);
  template.event.badgeLayout = null;
  template.event.staff = [];
  template.event.registrationForm.fields = Array.from(
    { length: 10 },
    (_, index) => ({
      key: `field_${index + 1}`,
      type: "SINGLE_CHOICE",
      label: `Question ${index + 1}`,
      description: null,
      required: false,
      options: Array.from({ length: 100 }, (_, option) => ({
        label: `${option}:`,
      })),
    }),
  );
  let remaining = bytes - Buffer.byteLength(JSON.stringify(template));

  for (const field of template.event.registrationForm.fields) {
    for (const option of field.options) {
      const room = 200 - option.label.length;
      const count = Math.min(room, Math.floor(remaining / 3));
      option.label += "漢".repeat(count);
      remaining -= count * 3;
      const ascii = Math.min(room - count, remaining);
      option.label += "x".repeat(ascii);
      remaining -= ascii;
    }
  }
  assert.equal(remaining, 0);
  assert.equal(Buffer.byteLength(JSON.stringify(template)), bytes);
  assert.ok(
    (template.version === 1
      ? eventTemplateV1Schema
      : eventTemplateV2Schema
    ).safeParse(template).success,
  );

  return template;
}

function checkBoundaries(v1: EventTemplateV1, v2: EventTemplateV2) {
  for (const seed of [v1, v2]) {
    for (const delta of [-1, 0, 1]) {
      const candidate = boundaryTemplate(
        seed,
        TEMPLATE_V1_LIMITS.bytes + delta,
      );
      const text = JSON.stringify(candidate);
      assert.ok(text.length < Buffer.byteLength(text));
      const result = parseTemplateText(text);

      if (delta > 0) {
        assert.ok(!result.success);
        assert.equal(result.issues[0].code, "limit");
        const direct = validateTemplateCreate(candidate);
        assert.ok(!direct.success);
        assert.equal(direct.issues[0].code, "limit");
      } else {
        assert.ok(result.success);
        assert.equal(result.sourceVersion, seed.version);
        const reviewed = canonicalizeReview(
          result.template.event,
          result.sourceVersion,
        );
        assert.ok(reviewed.success);
        const transport = templateCreateInput(
          reviewed.template.event,
          reviewed.sourceVersion,
        );
        assert.equal(transport.version, seed.version);
        assert.ok(parseTemplateText(JSON.stringify(transport)).success);
        assert.deepEqual(transport, candidate);
      }
    }
  }
  const legacy = parseTemplateText(
    JSON.stringify(boundaryTemplate(v1, TEMPLATE_V1_LIMITS.bytes)),
  );
  assert.ok(legacy.success);
  assert.equal(legacy.template.event.descriptionFormat, "PLAIN_TEXT");
  assert.deepEqual(legacy.template.event.schedule, []);
  assert.equal(legacy.template.event.location, null);
  assert.equal(legacy.template.event.publicOrganizer, null);
  assert.equal(legacy.template.event.cover.status, "NONE");
  assert.ok(
    Buffer.byteLength(JSON.stringify(legacy.template)) >
      TEMPLATE_V1_LIMITS.bytes,
  );
  const promoted = templateCreateInput(
    { ...legacy.template.event, descriptionFormat: "MARKDOWN" },
    legacy.sourceVersion,
  );
  assert.equal(promoted.version, 2);
  const tooRich = validateTemplateCreate(promoted);
  assert.ok(!tooRich.success);
  assert.equal(tooRich.issues[0].code, "limit");
  const malformed = parseTemplateText('{"format":');
  assert.ok(!malformed.success);
  assert.equal(malformed.issues[0].code, "json");
  console.log(
    "PASS: valid V1/V2 Unicode at 512 KiB -1/0/+1, exact limit errors, legacy Review/Create transport, normalization, rich promotion and JSON error distinction",
  );
}

async function main() {
  await checkCleanup();
  const v1 = {
    format: "event-flow-template",
    version: 1,
    event: {
      title: "29B isolated verification",
      description: "Plain **text**",
      startsAt: "2035-10-28T00:00:11.123Z",
      endsAt: "2035-10-28T03:00:22.456Z",
      timezone: "Europe/Berlin",
      visibility: "PRIVATE",
      accountRequirement: "OPTIONAL",
      capacity: null,
      maxGuestsPerRegistration: 0,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationForm: {
        fields: [
          {
            key: "field_1",
            type: "SHORT_TEXT",
            label: "Team",
            description: null,
            required: false,
            options: [],
          },
        ],
      },
      staff: [],
      badgeLayout: {
        ...defaultBadgeLayout,
        secondaryField: {
          fieldKey: "field_1",
          type: "SHORT_TEXT",
          label: "Team",
        },
      },
    },
  };
  assert.ok(eventTemplateV1Schema.safeParse(v1).success);
  const imported = parseTemplateText(JSON.stringify(v1));
  assert.ok(imported.success);
  assert.equal(imported.template.event.descriptionFormat, "PLAIN_TEXT");
  assert.deepEqual(imported.template.event.schedule, []);
  assert.equal(imported.template.event.publicOrganizer, null);
  assert.equal(imported.template.event.location, null);
  assert.equal(imported.template.event.cover.status, "NONE");
  const template = eventTemplateV2Schema.parse({
    ...imported.template,
    event: {
      ...imported.template.event,
      descriptionFormat: "MARKDOWN",
      location: {
        type: "HYBRID",
        venueName: "Hall",
        address: "Street",
        onlineLabel: "Join",
        onlineUrl: "https://example.com/meeting",
      },
      publicOrganizer: {
        displayName: "Authored organizer",
        description: null,
        websiteUrl: "https://example.com",
      },
      schedule: [
        {
          title: "First",
          description: null,
          startsAt: "2035-10-28T00:30:45.678Z",
        },
        {
          title: "Second",
          description: "Exact repeated local hour",
          startsAt: "2035-10-28T01:30:45.678Z",
        },
      ],
      cover: { status: "OMITTED" },
    },
  });
  const serialized = serializeEventTemplate(template);
  assert.ok(serialized.endsWith("\n"));
  const roundtrip = parseTemplateText(serialized);
  assert.ok(roundtrip.success);
  assert.deepEqual(roundtrip.template, template);
  for (const bad of [
    { ...v1, version: 99 },
    { ...v1, event: { ...v1.event, descriptionFormat: "MARKDOWN" } },
    { ...template, event: { ...template.event, storageKey: "private" } },
    {
      ...template,
      event: {
        ...template.event,
        cover: { status: "OMITTED", assetId: randomUUID() },
      },
    },
  ]) {
    assert.equal(validateTemplateCreate(bad).success, false);
  }
  checkBoundaries(eventTemplateV1Schema.parse(v1), template);
  assert.equal(
    eventTemplateV2Schema.safeParse({
      ...template,
      event: {
        ...template.event,
        schedule: Array.from({ length: 101 }, () => template.event.schedule[0]),
      },
    }).success,
    false,
  );
  for (const location of [
    null,
    { type: "PHYSICAL", venueName: "Hall", address: "Street" },
    { type: "ONLINE", onlineLabel: "Join", onlineUrl: "http://example.com" },
    template.event.location,
  ]) {
    assert.ok(
      eventTemplateV2Schema.safeParse({
        ...template,
        event: { ...template.event, location },
      }).success,
    );
  }
  for (const onlineUrl of [
    "javascript:alert(1)",
    "//example.com",
    "/relative",
    "https://user:pass@example.com",
  ]) {
    assert.equal(
      eventTemplateV2Schema.safeParse({
        ...template,
        event: {
          ...template.event,
          location: { type: "ONLINE", onlineLabel: "Join", onlineUrl },
        },
      }).success,
      false,
    );
  }
  const values = templateEventValues(template.event);
  const preserve = {
    startsAt: template.event.startsAt,
    endsAt: template.event.endsAt,
    registrationOpensAt: null,
    registrationClosesAt: null,
  };
  const unchanged = parseEventWithPreservedDates(
    values,
    preserve,
    template.event,
  );
  assert.ok(unchanged.success);
  assert.deepEqual(unchanged.data.schedule, template.event.schedule);
  assert.equal(unchanged.data.startsAt.toISOString(), template.event.startsAt);
  const changedTitle = structuredClone(values);
  changedTitle.schedule[0].title = "Changed title";
  assert.equal(
    parseEventWithPreservedDates(changedTitle, preserve, template.event).data
      ?.schedule[0].startsAt,
    template.event.schedule[0].startsAt,
  );
  const folded = structuredClone(values);
  folded.schedule[0].edited = true;
  const foldResult = parseEventWithPreservedDates(
    folded,
    preserve,
    template.event,
  );
  assert.equal(foldResult.success, false);
  assert.ok(
    !foldResult.success &&
      eventValidationError(foldResult.error, folded).errors?.[
        "schedule.agenda_0.startsAt"
      ],
  );
  const reordered = structuredClone(values);
  reordered.schedule.reverse();
  const orderResult = parseEventWithPreservedDates(
    reordered,
    preserve,
    template.event,
  );
  assert.equal(orderResult.success, false);
  assert.ok(
    !orderResult.success &&
      eventValidationError(orderResult.error, reordered).errors?.[
        "schedule.agenda_0.startsAt"
      ],
  );
  const equal = structuredClone(template);
  equal.event.schedule[1].startsAt = equal.event.schedule[0].startsAt;
  const equalValues = templateEventValues(equal.event);
  equalValues.schedule.reverse();
  assert.ok(
    parseEventWithPreservedDates(equalValues, preserve, equal.event).success,
  );
  const outOfRange = structuredClone(template);
  outOfRange.event.schedule[0].startsAt = outOfRange.event.endsAt;
  assert.equal(validateTemplateCreate(outOfRange).success, false);
  const gap = {
    ...values,
    startsAt: "2035-03-25T00:00",
    endsAt: "2035-03-25T05:00",
    schedule: [
      {
        ...values.schedule[0],
        sourceIndex: null,
        edited: true,
        startsAt: "2035-03-25T02:30",
      },
    ],
  };
  assert.equal(eventInputSchema.safeParse(gap).success, false);
  const utc = parseEventWithPreservedDates(
    { ...values, timezone: "UTC" },
    preserve,
    template.event,
  );
  assert.ok(utc.success);
  assert.equal(utc.data.schedule[0].startsAt, "2035-10-28T02:30:00.000Z");
  const incomplete = parseEventWithPreservedDates(
    {
      ...values,
      location: { type: "PHYSICAL", venueName: "Hall", address: "" },
    },
    preserve,
    template.event,
  );
  assert.ok(
    !incomplete.success &&
      eventValidationError(incomplete.error).errors?.["location.address"],
  );
  const canonical = canonicalizeReview({
    ...template.event,
    registrationForm: {
      fields: [
        { ...template.event.registrationForm.fields[0], key: "field_9" },
      ],
    },
    badgeLayout: {
      ...defaultBadgeLayout,
      tertiaryField: null,
      secondaryField: {
        fieldKey: "field_9",
        type: "SHORT_TEXT",
        label: "Team",
      },
    },
  });
  assert.ok(canonical.success);
  assert.equal(
    canonical.template.event.badgeLayout?.secondaryField?.fieldKey,
    "field_1",
  );
  console.log(
    "PASS: V1/V2 strict parsing, rich round-trip, limits, location, exact agenda instants, DST, stable error paths, ordering and Badge identity",
  );

  if (process.argv.includes("--pure")) {
    return;
  }

  loadEnvConfig(process.cwd(), true);
  const original = process.env.DATABASE_URL;
  assert.ok(original);
  const url = new URL(original);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  const name = `event_flow_verify_29b_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({
    connectionString: original,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  let created = false;
  let browserServer: ChildProcess | undefined;
  let mediaRoot: string | undefined;
  let db: typeof import("@/lib/prisma")["prisma"] | undefined;
  let connection: Client | undefined;
  const failures: unknown[] = [];
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    created = true;
    url.pathname = `/${name}`;
    process.env.DATABASE_URL = url.toString();
    connection = new Client({ connectionString: url.toString() });
    await connection.connect();
    for (const migration of (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()) {
      await connection.query(
        await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    }
    const { prisma } = await import("@/lib/prisma");
    db = prisma;
    const { createTemplateEvent } = await import(
      "@/features/events/server/create-template-event"
    );
    const { createEventCore } = await import(
      "@/features/events/server/create-event-core"
    );
    const { readEventTemplate } = await import(
      "@/features/exports/server/event-template"
    );
    const { publishOwnedEvent } = await import(
      "@/features/events/server/publish-event"
    );
    const { lockEventForUpdate } = await import(
      "@/features/events/server/lock-event-for-update"
    );
    const owner = await prisma.user.create({
      data: {
        name: "Isolated Owner",
        email: "owner-29b@example.invalid",
        emailVerified: true,
      },
    });
    const staff = await prisma.user.create({
      data: {
        name: "Isolated Staff",
        email: "staff-29b@example.invalid",
        emailVerified: true,
      },
    });
    const organizer = await prisma.organizerProfile.create({
      data: { userId: owner.id },
    });
    const outcome = await createTemplateEvent(owner.id, organizer.id, {
      ...template,
      event: {
        ...template.event,
        staff: [
          { email: staff.email.toUpperCase(), role: "MANAGER" },
          { email: staff.email, role: "MANAGER" },
          { email: owner.email, role: "RECEPTION" },
        ],
      },
    });
    assert.ok(outcome.success);
    assert.equal(outcome.addedCount, 1);
    assert.deepEqual(outcome.skippedEmails, [owner.email]);
    assert.deepEqual(outcome.duplicateWarnings, [staff.email]);
    const row = await prisma.event.findUniqueOrThrow({
      where: { id: outcome.eventId },
      include: { registrationForm: { include: { fields: true } } },
    });
    assert.equal(row.coverAssetId, null);
    assert.equal(row.contentVersion, 1);
    assert.equal(row.publishedRevisionId, null);
    assert.deepEqual(row.schedule, template.event.schedule);
    const badge = readBadgeLayout(row.badgeLayout);
    assert.ok(badge.success);
    assert.equal(
      badge.data.secondaryField?.fieldId,
      row.registrationForm?.fields[0].id,
    );
    assert.equal(await readEventTemplate(staff.id, row.id), null);
    const exported = await readEventTemplate(owner.id, row.id);
    assert.ok(exported);
    assert.equal(exported.version, 2);
    assert.equal(exported.event.cover.status, "NONE");
    assert.deepEqual(exported.event.schedule, template.event.schedule);
    const copy = await createTemplateEvent(owner.id, organizer.id, exported);
    assert.ok(copy.success);
    const copiedFields = await prisma.registrationField.findMany({
      where: { form: { eventId: copy.eventId } },
    });
    assert.notEqual(copiedFields[0].id, row.registrationForm?.fields[0].id);
    assert.equal(
      (
        await publishOwnedEvent(organizer.id, {
          eventId: row.id,
          contentVersion: 1,
        })
      ).success,
      true,
    );
    assert.equal(
      (
        await publishOwnedEvent(organizer.id, {
          eventId: row.id,
          contentVersion: 1,
        })
      ).success,
      true,
    );
    assert.equal(
      await prisma.eventRevision.count({ where: { eventId: row.id } }),
      1,
    );
    const revision = await prisma.eventRevision.findFirstOrThrow({
      where: { eventId: row.id },
    });
    assert.equal(
      (revision.snapshot as { schemaVersion: number }).schemaVersion,
      3,
    );
    await prisma.$transaction(async (tx) => {
      const locked = await lockEventForUpdate(tx, {
        id: row.id,
        organizerId: organizer.id,
      });
      assert.ok(locked);
      const input = eventFormValues(locked);
      input.title = "Unrelated edit";
      const parsed = parseEventEdit(input, eventDateSource(locked), [], false);
      assert.ok(parsed.success);
      assert.deepEqual(parsed.data.schedule, template.event.schedule);
      assert.equal(parsed.data.startsAt.toISOString(), template.event.startsAt);
      const spoofed = structuredClone(input);
      spoofed.schedule[0].startsAt = "2035-10-28T02:31";
      assert.equal(
        parseEventEdit(spoofed, eventDateSource(locked), [], false).success,
        false,
      );
      const ongoing = {
        ...input,
        timezone: "UTC",
        startsAt: "2035-10-28T00:00",
      };
      assert.equal(
        parseEventEdit(
          ongoing,
          eventDateSource(locked),
          [],
          true,
        ).data?.startsAt.toISOString(),
        template.event.startsAt,
      );
    });
    const legacyCreated = await createTemplateEvent(owner.id, organizer.id, {
      ...v1,
      event: { ...v1.event, staff: [{ email: staff.email, role: "MANAGER" }] },
    });
    assert.ok(legacyCreated.success);
    assert.equal(legacyCreated.addedCount, 1);
    const legacyRow = await prisma.event.findUniqueOrThrow({
      where: { id: legacyCreated.eventId },
      include: { registrationForm: { include: { fields: true } } },
    });
    const legacyBadge = readBadgeLayout(legacyRow.badgeLayout);
    assert.ok(legacyBadge.success);
    assert.equal(
      legacyBadge.data.secondaryField?.fieldId,
      legacyRow.registrationForm?.fields[0].id,
    );
    const nullable = await prisma.$queryRaw<
      { location_null: boolean; organizer_null: boolean }[]
    >`SELECT location IS NULL AS location_null, "publicOrganizer" IS NULL AS organizer_null FROM "Event" WHERE id = ${legacyCreated.eventId}::uuid`;
    assert.deepEqual(nullable, [{ location_null: true, organizer_null: true }]);
    for (const seed of [eventTemplateV1Schema.parse(v1), template]) {
      const boundary = boundaryTemplate(seed, TEMPLATE_V1_LIMITS.bytes);
      const parsedBoundary = parseTemplateText(JSON.stringify(boundary));
      assert.ok(parsedBoundary.success);
      const review = canonicalizeReview(
        parsedBoundary.template.event,
        parsedBoundary.sourceVersion,
      );
      assert.ok(review.success);
      const payload = templateCreateInput(
        review.template.event,
        review.sourceVersion,
      );
      // Same transport/normalization boundary used by the authenticated import adapter.
      const serverParsed = parseTemplateText(JSON.stringify(payload));
      assert.ok(serverParsed.success);
      const createdBoundary = await createTemplateEvent(
        owner.id,
        organizer.id,
        templateCreateInput(
          serverParsed.template.event,
          serverParsed.sourceVersion,
        ),
      );
      assert.ok(createdBoundary.success);
      const stored = await readEventTemplate(owner.id, createdBoundary.eventId);
      assert.ok(stored);
      assert.deepEqual(
        stored.event.registrationForm,
        boundary.event.registrationForm,
      );
      assert.equal(
        stored.event.registrationForm.fields.reduce(
          (sum, field) => sum + field.options.length,
          0,
        ),
        1000,
      );
    }
    console.log(
      "PASS: exact-boundary V1 and V2 survive Review, server revalidation and atomic Create without truncation",
    );
    const count = await prisma.event.count();
    await assert.rejects(
      prisma.$transaction((tx) =>
        createEventCore(
          tx,
          organizer.id,
          unchanged.data,
          template.event.registrationForm.fields,
          template.event.badgeLayout,
          [{ userId: randomUUID(), role: "MANAGER" }],
        ),
      ),
    );
    assert.equal(await prisma.event.count(), count);
    assert.equal(await prisma.emailOutbox.count(), 0);
    console.log(
      "PASS: isolated V1/V2 atomic Create, SQL NULL, Staff normalization/RBAC, new Badge IDs, duplicate, locked exact dates, V3 publication/no-op, rollback, no mail intents",
    );

    if (process.argv.includes("--browser")) {
      const password = "Isolated-29B-Only!";
      await prisma.account.create({
        data: {
          userId: owner.id,
          accountId: owner.id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      });
      mediaRoot = await mkdtemp(
        path.join(
          homedir(),
          "Library",
          "Application Support",
          "event-flow-verify-29b-",
        ),
      );
      await chmod(mediaRoot, 0o700);
      await sharp({
        create: { width: 640, height: 320, channels: 3, background: "#5353a0" },
      })
        .png()
        .toFile(path.join(mediaRoot, "upload.png"));
      browserServer = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--port",
          "3029",
          "--hostname",
          "127.0.0.1",
        ],
        {
          stdio: ["ignore", "inherit", "inherit"],
          env: {
            ...process.env,
            NODE_ENV: "production",
            BETTER_AUTH_URL: "http://127.0.0.1:3029",
            MEDIA_STORAGE_ROOT: mediaRoot,
            SMTP_PORT: "1",
          },
        },
      );
      console.log(
        `BROWSER: http://127.0.0.1:3029/dashboard/events/${row.id}/edit`,
      );
      console.log(`ISOLATED LOGIN: ${owner.email} / ${password}`);
      console.log(`UPLOAD FIXTURE: ${path.join(mediaRoot, "upload.png")}`);
      console.log(
        "Press Enter after browser verification to stop server and remove isolated resources.",
      );
      await waitForBrowser(browserServer);
      process.stdin.pause();
      assert.equal(await prisma.emailOutbox.count(), 0);
    }
  } catch (error) {
    failures.push(error);
  } finally {
    process.stdin.pause();
    process.env.DATABASE_URL = original;
    await finishVerification(failures, [
      {
        name: "browser child",
        run: async () => {
          if (browserServer) await stopVerificationChild(browserServer);
        },
      },
      { name: "Prisma disconnect", run: async () => db?.$disconnect() },
      { name: "SQL disconnect", run: async () => connection?.end() },
      {
        name: "verification database removal",
        run: async () => {
          if (created) {
            assert.match(name, /^event_flow_verify_29b_[a-f0-9]{32}$/);
            assert.notEqual(name, new URL(original).pathname.slice(1));
            await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
          }
        },
      },
      { name: "admin disconnect", run: async () => admin.end() },
      {
        name: "verification media removal",
        run: async () => {
          if (mediaRoot) {
            assert.equal(
              path.dirname(mediaRoot),
              path.join(homedir(), "Library", "Application Support"),
            );
            assert.ok(
              path.basename(mediaRoot).startsWith("event-flow-verify-29b-"),
            );
            await rm(mediaRoot, { recursive: true, force: true });
          }
        },
      },
    ]);
    console.log(
      "PASS: disposable database, browser server and media cleaned up",
    );
  }
}

main().catch((error) => {
  console.error(error);
  // All cleanup attempts have completed or timed out before this terminal failure.
  process.exit(1);
});
