// Requested 29A checks: disposable DB and private storage, no SMTP or app server.
import assert from "node:assert/strict";
import { type ChildProcess, execFile } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import sharp from "sharp";
import {
  boundedCleanup,
  stopVerificationServer,
  verificationControl,
} from "./public-event-verification-cleanup";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const originalUrl = process.env.DATABASE_URL;
  const originalRoot = process.env.MEDIA_STORAGE_ROOT;
  assert.ok(originalUrl);
  const url = new URL(originalUrl);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  const databaseName = `event_flow_verify_29a_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({
    connectionString: originalUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10_000,
    query_timeout: 15_000,
  });
  let connection: Client | undefined;
  let db: typeof import("@/lib/prisma")["prisma"] | undefined;
  let created = false;
  let root: string | undefined;
  let maintenanceChild: ChildProcess | undefined;
  const failures: unknown[] = [];
  const results: string[] = [];
  // Install before connecting or allocating resources; keep active through cleanup.
  const control = verificationControl(180_000);
  const { signal } = control;
  admin.on("error", control.abort);

  async function checkpoint(stage: string) {
    signal.throwIfAborted();

    if (process.argv.includes(`--cleanup-probe=${stage}`)) {
      console.log(
        JSON.stringify({
          checkpoint: stage,
          database: databaseName,
          root,
          childPid: maintenanceChild?.pid,
        }),
      );
      await delay(30_000, undefined, { signal });
      throw new Error("Cleanup probe did not receive a signal");
    }
  }

  async function runMaintenance(args: string[], probe = false) {
    signal.throwIfAborted();
    const task = promisify(execFile)(process.execPath, args, {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        MEDIA_STORAGE_ROOT: root,
      },
      timeout: 30_000,
      killSignal: "SIGKILL",
    });
    maintenanceChild = task.child;
    // The child can reject while the probe awaits readiness or interruption.
    void task.catch(() => {});
    let interrupted = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      interrupted = () => reject(signal.reason);
      signal.addEventListener("abort", interrupted, { once: true });
    });
    // Readiness/probe waits may throw before the final race is reached.
    void cancelled.catch(() => {});

    try {
      if (probe) {
        assert.ok(maintenanceChild.stdout);
        await Promise.race([
          once(maintenanceChild.stdout, "data", { signal }),
          task.then(() => {
            throw new Error("Probe child exited before interruption");
          }),
        ]);
        await checkpoint("child");
      }

      return await Promise.race([task, cancelled]);
    } finally {
      signal.removeEventListener("abort", interrupted);
    }
  }

  try {
    signal.throwIfAborted();
    await admin.connect();
    signal.throwIfAborted();
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
    created = true;
    await checkpoint("database");
    url.pathname = `/${databaseName}`;
    url.searchParams.set(
      "options",
      "-c statement_timeout=10000 -c lock_timeout=5000",
    );
    process.env.DATABASE_URL = url.toString();
    connection = new Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
      query_timeout: 15_000,
    });
    connection.on("error", control.abort);
    await connection.connect();

    for (const migration of (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()) {
      signal.throwIfAborted();
      await connection.query(
        await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    }

    const parent = path.join(homedir(), "Library", "Application Support");
    await mkdir(parent, { recursive: true });
    root = await mkdtemp(path.join(parent, "event-flow-verify-29a-"));
    await chmod(root, 0o700);
    await checkpoint("media");
    process.env.MEDIA_STORAGE_ROOT = root;
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
    if (process.argv.includes("--cleanup-probe=child")) {
      await runMaintenance(
        [
          "-e",
          "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
        ],
        true,
      );
    }

    if (process.argv.includes("--cleanup-failure")) {
      console.log(
        JSON.stringify({ checkpoint: "failure", database: databaseName, root }),
      );
      throw new Error("Original verification failure");
    }
    signal.throwIfAborted();
    const {
      normalizeImage,
      readUpload,
      withImageSlot,
      maxUploadBytes,
      MediaError,
    } = await import("@/features/events/server/media-image");
    const {
      attachEventCover,
      uploadEventCover,
      uploadLifetimeMs,
      lockMediaAsset,
    } = await import("@/features/events/server/media-assets");
    const { cleanupMedia, mediaCleanupBudget } = await import(
      "@/features/events/server/media-cleanup"
    );
    const { mediaStorage } = await import("@/lib/media-storage");
    const { mediaActor, serveEventMedia } = await import(
      "@/features/events/server/media-http"
    );
    const { publishOwnedEvent } = await import(
      "@/features/events/server/publish-event"
    );
    const { changeOwnedEventLifecycle } = await import(
      "@/features/events/server/event-lifecycle"
    );
    const { getPublishedEvent } = await import(
      "@/features/events/server/get-published-event"
    );
    const { eventSnapshotSchema } = await import(
      "@/features/events/schemas/event-snapshot"
    );
    const { rejectionEventTitle } = await import("@/lib/email-outbox/payload");
    const { readEventTemplate } = await import(
      "@/features/exports/server/event-template"
    );
    const { serializeEventTemplate } = await import(
      "@/features/exports/event-template"
    );
    const { validateTemplateCreate } = await import(
      "@/features/events/import/template-input"
    );
    const { POST } = await import(
      "@/app/api/events/[eventId]/cover/uploads/route"
    );
    const { PUT } = await import("@/app/api/events/[eventId]/cover/route");
    const { auth } = await import("@/lib/auth");
    const origin = process.env.BETTER_AUTH_URL ?? "";
    const future = new Date(Date.now() + 2 * uploadLifetimeMs);
    const end = new Date(future.getTime() + uploadLifetimeMs);
    const users = await Promise.all(
      ["owner", "manager", "reception", "foreign", "unverified"].map((name) =>
        prisma.user.create({
          data: {
            name,
            email: `${name}@media.example.test`,
            emailVerified: name !== "unverified",
          },
        }),
      ),
    );
    const [owner, manager, reception, foreign, unverified] = users;
    const organizer = await prisma.organizerProfile.create({
      data: { userId: owner.id },
    });
    const otherOrganizer = await prisma.organizerProfile.create({
      data: { userId: foreign.id },
    });
    const createEvent = (organizerId = organizer.id) =>
      prisma.event.create({
        data: {
          organizerId,
          title: "29A isolated verification",
          description: "Plain *text*",
          startsAt: future,
          endsAt: end,
          timezone: "Europe/Berlin",
          visibility: "PUBLIC",
          registrationForm: { create: {} },
        },
      });
    const event = await createEvent();
    const second = await createEvent();
    const foreignEvent = await createEvent(otherOrganizer.id);
    await prisma.eventStaff.createMany({
      data: [
        { eventId: event.id, userId: manager.id, role: "MANAGER" },
        { eventId: event.id, userId: reception.id, role: "RECEPTION" },
      ],
    });
    const cookieName = (await auth.$context).authCookies.sessionToken.name;
    const cookies = new Map<string, string>();

    for (const user of users) {
      const token = randomBytes(32).toString("hex");
      await prisma.session.create({
        data: { userId: user.id, token, expiresAt: end },
      });
      const signature = createHmac(
        "sha256",
        process.env.BETTER_AUTH_SECRET ?? "",
      )
        .update(token)
        .digest("base64");
      cookies.set(
        user.id,
        `${cookieName}=${encodeURIComponent(`${token}.${signature}`)}`,
      );
    }

    const png = await sharp({
      create: { width: 80, height: 40, channels: 4, background: "#4488ff" },
    })
      .png()
      .toBuffer();
    const request = (
      userId = owner.id,
      body: Uint8Array = png,
      contentType = "image/png",
      requestOrigin = origin,
    ) =>
      new Request(`${origin}/api/events/${event.id}/cover/uploads`, {
        method: "POST",
        headers: {
          cookie: cookies.get(userId) ?? "",
          origin: requestOrigin,
          "content-type": contentType,
        },
        body: new Uint8Array(body),
      });
    const context = { params: Promise.resolve({ eventId: event.id }) };
    assert.equal(await mediaActor(request(), true), owner.id);
    assert.equal(
      (
        await POST(
          request(owner.id, png, "image/png", "https://foreign.invalid"),
          context,
        )
      ).status,
      403,
    );
    assert.equal((await POST(request("anonymous"), context)).status, 404);

    for (const user of [manager, reception, foreign, unverified]) {
      assert.equal((await POST(request(user.id), context)).status, 404);
    }

    assert.equal(
      (
        await POST(request(), {
          params: Promise.resolve({ eventId: randomUUID() }),
        })
      ).status,
      404,
    );
    assert.equal(await prisma.mediaAsset.count(), 0);
    signal.throwIfAborted();
    results.push(
      "fresh real signed sessions, verified OWNER, Event scope and Origin",
    );

    const limitRequest = (length: number) =>
      new Request(`${origin}/upload`, {
        method: "POST",
        headers: { "content-length": "1" },
        body: new Uint8Array(length),
      });
    assert.equal(
      (await readUpload(limitRequest(maxUploadBytes))).length,
      maxUploadBytes,
    );
    await assert.rejects(
      readUpload(limitRequest(maxUploadBytes + 1)),
      (error: unknown) => error instanceof MediaError && error.status === 413,
    );
    assert.ok(
      global.gc,
      "Run verification with --expose-gc for retained-memory checks.",
    );

    for (const length of [256 * 1024, maxUploadBytes, maxUploadBytes + 1]) {
      global.gc();
      const before = process.memoryUsage();
      let sent = 0;
      let retained = 0;
      const tinyRequest = new Request(`${origin}/tiny-upload`, {
        method: "POST",
        body: new ReadableStream<Uint8Array>({
          pull(controller) {
            if (sent === length) {
              global.gc?.();
              retained = process.memoryUsage().heapUsed - before.heapUsed;
              controller.close();

              return;
            }

            sent += 1;
            controller.enqueue(new Uint8Array([7]));
          },
          cancel() {
            global.gc?.();
            retained = process.memoryUsage().heapUsed - before.heapUsed;
          },
        }),
        duplex: "half",
      } as RequestInit);

      if (length > maxUploadBytes) {
        await assert.rejects(
          readUpload(tinyRequest),
          (error: unknown) =>
            error instanceof MediaError && error.status === 413,
        );
      } else {
        const bytes = await readUpload(tinyRequest);
        assert.equal(bytes.length, length);
        assert.equal(bytes[0], 7);
        assert.equal(bytes[length - 1], 7);
        assert.equal(bytes.buffer.byteLength, maxUploadBytes);
      }

      assert.ok(
        retained < 8 * 1024 * 1024,
        `Retained heap grew by ${retained}`,
      );
      signal.throwIfAborted();
      results.push(
        `1-byte chunks: ${length} bytes; retained heap delta ${retained} bytes; bounded backing buffer`,
      );
    }

    await assert.rejects(normalizeImage(png, "image/jpeg"));
    await assert.rejects(
      normalizeImage(Buffer.from("<svg></svg>"), "image/png"),
    );
    await assert.rejects(
      normalizeImage(png.subarray(0, png.length - 2), "image/png"),
    );
    await assert.rejects(
      normalizeImage(
        Buffer.concat([png, Buffer.from("<script>alert(1)</script>")]),
        "image/png",
      ),
    );
    const large = await sharp({
      create: { width: 4096, height: 4096, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    assert.equal(
      (await normalizeImage(large, "image/png")).manifest["1920"].width,
      1920,
    );
    const tooWide = await sharp({
      create: { width: 4097, height: 1, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    await assert.rejects(normalizeImage(tooWide, "image/png"));
    const pixels = Buffer.alloc(4 * 4 * 3, 100);
    pixels.fill(230, pixels.length / 2);
    const animated = await sharp(pixels, {
      raw: { width: 4, height: 4, channels: 3, pageHeight: 2 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    assert.equal((await sharp(animated).metadata()).pages, 2);
    await assert.rejects(normalizeImage(animated, "image/webp"));
    const jpeg = await sharp(png)
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Artist: "Private metadata" } })
      .jpeg()
      .toBuffer();
    const normalized = await normalizeImage(jpeg, "image/jpeg");
    assert.equal(normalized.manifest["640"].width, 40);
    assert.equal(normalized.manifest["640"].height, 80);

    for (const bytes of normalized.variants.values()) {
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.xmp, undefined);
      assert.equal(metadata.iptc, undefined);
      assert.equal(metadata.icc, undefined);
    }

    const webp = await sharp(png).webp().toBuffer();
    await normalizeImage(webp, "image/webp");
    await assert.rejects(
      normalizeImage(
        Buffer.concat([webp, Buffer.from("payload")]),
        "image/webp",
      ),
    );
    await assert.rejects(
      normalizeImage(
        Buffer.concat([jpeg, Buffer.from("payload")]),
        "image/jpeg",
      ),
    );
    let releaseSlots = () => {};
    const held = new Promise<void>((resolve) => {
      releaseSlots = resolve;
    });
    const slotA = withImageSlot(() => held);
    const slotB = withImageSlot(() => held);
    await assert.rejects(
      withImageSlot(async () => {}),
      (error: unknown) => error instanceof MediaError && error.status === 429,
    );
    releaseSlots();
    await Promise.all([slotA, slotB]);
    await withImageSlot(async () => {});
    signal.throwIfAborted();
    results.push(
      "actual 5 MiB boundary, 4096 dimensions/pixels, formats, malformed/appended-polyglot/animation rejection, orientation/metadata, two processing slots",
    );

    const response = await POST(request(), context);
    assert.equal(response.status, 201, await response.clone().text());
    const cover = (await response.json()) as { assetId: string };
    const firstAsset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: cover.assetId },
    });
    assert.equal(firstAsset.state, "READY");
    assert.equal(firstAsset.eventId, event.id);
    const storage = mediaStorage();
    await assert.rejects(storage.read("../escape", "640"));
    await assert.rejects(storage.write(firstAsset.storageKey, "640", png));
    const validRoot = process.env.MEDIA_STORAGE_ROOT;
    process.env.MEDIA_STORAGE_ROOT = "/private/tmp";
    await assert.rejects(storage.validate());
    process.env.MEDIA_STORAGE_ROOT = process.cwd();
    await assert.rejects(storage.validate());
    process.env.MEDIA_STORAGE_ROOT = validRoot;
    const unsafeParent = path.join(root, "unsafe-parent");
    const nestedRoot = path.join(unsafeParent, "storage");
    await mkdir(nestedRoot, { recursive: true, mode: 0o700 });
    await chmod(nestedRoot, 0o700);
    await chmod(unsafeParent, 0o777);
    process.env.MEDIA_STORAGE_ROOT = nestedRoot;
    await assert.rejects(
      storage.validate(),
      /ownership, permissions or symlink/,
    );
    await chmod(unsafeParent, 0o700);
    await storage.validate();
    const linkedParent = path.join(root, "linked-parent");
    await symlink(unsafeParent, linkedParent);
    process.env.MEDIA_STORAGE_ROOT = path.join(linkedParent, "storage");
    await assert.rejects(storage.validate());
    process.env.MEDIA_STORAGE_ROOT = nestedRoot;
    await chmod(nestedRoot, 0o750);
    await assert.rejects(storage.validate());
    await chmod(nestedRoot, 0o700);
    process.env.MEDIA_STORAGE_ROOT = validRoot;
    await unlink(linkedParent);
    await rm(unsafeParent, { recursive: true });
    await assert.rejects(
      storage.removeOrphan("../escape.640.webp", new Date()),
    );
    const symlinkKey = randomBytes(16).toString("hex");
    const outsideFile = path.join(root, "unmanaged-file");
    await writeFile(outsideFile, "keep");
    const symbolic = path.join(root, `${symlinkKey}.640.webp`);
    await symlink(outsideFile, symbolic);
    await assert.rejects(storage.read(symlinkKey, "640"));
    await assert.rejects(storage.remove(symlinkKey));
    assert.equal(await readFile(outsideFile, "utf8"), "keep");
    await unlink(symbolic);

    const preview = await serveEventMedia(request(), {
      eventId: event.id,
      assetId: cover.assetId,
      variant: "640",
    });
    assert.equal(
      preview.headers.get("cache-control"),
      "private, no-store, max-age=0",
    );
    assert.equal(preview.headers.get("content-type"), "image/webp");
    assert.equal(preview.headers.get("x-content-type-options"), "nosniff");
    assert.match(preview.headers.get("x-robots-tag") ?? "", /noindex/);
    await assert.rejects(
      serveEventMedia(request(manager.id), {
        eventId: event.id,
        assetId: cover.assetId,
        variant: "640",
      }),
    );
    await assert.rejects(
      serveEventMedia(request(), {
        eventId: second.id,
        assetId: cover.assetId,
        variant: "640",
      }),
    );
    await assert.rejects(
      serveEventMedia(request(), {
        eventId: event.id,
        assetId: cover.assetId,
        variant: "999",
      }),
    );
    signal.throwIfAborted();
    results.push(
      "immutable files, private root, traversal/symlink safety, owner Event-bound preview and headers",
    );

    const version = (row: { updatedAt: Date }) =>
      Buffer.from(row.updatedAt.toISOString()).toString("base64url");
    const v1template = await readEventTemplate(owner.id, event.id);
    assert.ok(v1template);
    assert.equal(
      validateTemplateCreate(JSON.parse(serializeEventTemplate(v1template)))
        .success,
      true,
    );
    await assert.rejects(
      attachEventCover(owner.id, second.id, {
        assetId: cover.assetId,
        alt: null,
        version: version(second),
      }),
    );
    await assert.rejects(
      attachEventCover(foreign.id, event.id, {
        assetId: cover.assetId,
        alt: null,
        version: version(event),
      }),
    );
    const attached = await attachEventCover(owner.id, event.id, {
      assetId: cover.assetId,
      alt: "Frozen alt",
      version: version(event),
    });
    assert.equal(attached.contentVersion, 2);
    await assert.rejects(
      attachEventCover(owner.id, event.id, {
        assetId: null,
        alt: null,
        version: version(event),
      }),
      (error: unknown) => error instanceof MediaError && error.status === 409,
    );
    assert.equal(
      (await readEventTemplate(owner.id, event.id))?.event.cover.status,
      "OMITTED",
    );
    // Fail after revision insertion, while switching the publication pointer.
    // The trigger exists only in this disposable verification database.
    await connection.query(`
      CREATE FUNCTION verify_media_publication_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."publishedRevisionId" IS NOT NULL AND NEW."publishedRevisionId" IS DISTINCT FROM OLD."publishedRevisionId" THEN
          RAISE EXCEPTION 'isolated publication failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER verify_media_publication_failure BEFORE UPDATE ON "Event"
        FOR EACH ROW EXECUTE FUNCTION verify_media_publication_failure();
    `);

    try {
      const failedPublication = await publishOwnedEvent(organizer.id, {
        eventId: event.id,
        contentVersion: 2,
      });
      assert.notEqual(failedPublication.success, true);
      assert.equal(
        await prisma.eventRevision.count({ where: { eventId: event.id } }),
        0,
      );
      assert.equal(
        (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
          .publishedRevisionId,
        null,
      );
      assert.equal(
        (
          await prisma.mediaAsset.findUniqueOrThrow({
            where: { id: cover.assetId },
          })
        ).state,
        "READY",
      );
      assert.ok((await storage.read(firstAsset.storageKey, "640")).length > 0);
    } finally {
      await connection.query(
        'DROP TRIGGER verify_media_publication_failure ON "Event"; DROP FUNCTION verify_media_publication_failure();',
      );
    }

    const published = await publishOwnedEvent(organizer.id, {
      eventId: event.id,
      contentVersion: 2,
    });
    assert.equal(published.success, true, JSON.stringify(published));
    const firstPublication = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { publishedRevision: true },
    });
    assert.ok(firstPublication.publicId && firstPublication.publishedRevision);
    assert.equal(
      firstPublication.publishedRevision.coverAssetId,
      cover.assetId,
    );
    const frozen = JSON.stringify(firstPublication.publishedRevision.snapshot);
    assert.ok(
      !frozen.includes(firstAsset.storageKey) && !frozen.includes(root),
    );
    const snapshot = eventSnapshotSchema.parse(
      firstPublication.publishedRevision.snapshot,
    );
    assert.equal(snapshot.schemaVersion, 3);
    assert.equal(rejectionEventTitle(snapshot), event.title);
    await publishOwnedEvent(organizer.id, {
      eventId: event.id,
      contentVersion: 2,
    });
    assert.equal(
      await prisma.eventRevision.count({ where: { eventId: event.id } }),
      1,
    );
    const publicContext = {
      publicId: firstPublication.publicId,
      assetId: cover.assetId,
      variant: "640",
    };
    assert.equal(
      (await serveEventMedia(new Request(`${origin}/public`), publicContext))
        .status,
      200,
    );
    const replacement = await uploadEventCover(owner.id, event.id, request());
    const replaced = await attachEventCover(owner.id, event.id, {
      assetId: replacement.assetId,
      alt: "New draft",
      version: attached.version,
    });
    assert.equal(
      (await serveEventMedia(new Request(`${origin}/public`), publicContext))
        .status,
      200,
    );
    await assert.rejects(
      serveEventMedia(new Request(`${origin}/public`), {
        ...publicContext,
        assetId: replacement.assetId,
      }),
    );
    assert.deepEqual(
      (await getPublishedEvent(firstPublication.publicId))?.snapshot,
      JSON.parse(frozen),
    );
    assert.equal(
      (
        await publishOwnedEvent(organizer.id, {
          eventId: event.id,
          contentVersion: replaced.contentVersion,
        })
      ).success,
      true,
    );
    await assert.rejects(
      serveEventMedia(new Request(`${origin}/public`), publicContext),
    );
    const replacementPublic = {
      ...publicContext,
      assetId: replacement.assetId,
    };
    assert.equal(
      (
        await serveEventMedia(
          new Request(`${origin}/public`),
          replacementPublic,
        )
      ).status,
      200,
    );
    const removed = await attachEventCover(owner.id, event.id, {
      assetId: null,
      alt: null,
      version: replaced.version,
    });
    assert.equal(
      (
        await serveEventMedia(
          new Request(`${origin}/public`),
          replacementPublic,
        )
      ).status,
      200,
    );
    const stalePublish = await publishOwnedEvent(organizer.id, {
      eventId: event.id,
      contentVersion: replaced.contentVersion,
    });
    assert.equal(stalePublish.conflict, true);
    assert.equal(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .contentVersion,
      removed.contentVersion,
    );
    assert.equal(
      await prisma.mediaAsset.count({
        where: { id: { in: [cover.assetId, replacement.assetId] } },
      }),
      2,
    );
    assert.equal(
      (
        await changeOwnedEventLifecycle(organizer.id, {
          eventId: event.id,
          action: "unpublish",
        })
      ).success,
      true,
    );
    await assert.rejects(
      serveEventMedia(new Request(`${origin}/public`), replacementPublic),
    );
    assert.equal(await getPublishedEvent(firstPublication.publicId), null);
    await publishOwnedEvent(organizer.id, {
      eventId: event.id,
      contentVersion: removed.contentVersion,
    });
    assert.equal(
      await prisma.eventRevision.count({ where: { eventId: event.id } }),
      3,
    );
    assert.equal(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .publicId,
      firstPublication.publicId,
    );
    await assert.rejects(
      prisma.mediaAsset.delete({ where: { id: cover.assetId } }),
    );
    signal.throwIfAborted();
    results.push(
      "attachment/version guards, V2 cover omission, v3 FK/snapshot, no-op, replace/remove isolation, failed Publish preservation, republish/unpublish and historical FK retention",
    );

    assert.equal(snapshot.schemaVersion, 3);

    if (snapshot.schemaVersion !== 3) {
      throw new Error("Expected v3");
    }

    const {
      cover: _cover,
      descriptionFormat: _format,
      location: _location,
      schedule: _schedule,
      publicOrganizer: _organizer,
      ...legacy
    } = snapshot;
    const v2 = { ...legacy, schemaVersion: 2 };
    const { maxGuestsPerRegistration: _guests, ...oldest } = v2;
    const v1 = { ...oldest, schemaVersion: 1 };
    assert.equal(eventSnapshotSchema.parse(v1).schemaVersion, 1);
    assert.equal(eventSnapshotSchema.parse(v2).schemaVersion, 2);
    assert.equal(rejectionEventTitle(v1), event.title);
    assert.equal(rejectionEventTitle(v2), event.title);
    assert.equal(
      eventSnapshotSchema.safeParse({ ...snapshot, storageKey: "forbidden" })
        .success,
      false,
    );
    const legacyRevision = await prisma.eventRevision.create({
      data: {
        eventId: second.id,
        number: 1,
        contentVersion: 1,
        snapshot: v2,
        publishedAt: new Date(),
      },
    });
    await prisma.event.update({
      where: { id: second.id },
      data: {
        publicId: randomUUID(),
        publishedAt: new Date(),
        publishedRevisionId: legacyRevision.id,
      },
    });
    assert.equal(
      (
        await publishOwnedEvent(organizer.id, {
          eventId: second.id,
          contentVersion: 1,
        })
      ).success,
      true,
    );
    assert.equal(
      await prisma.eventRevision.count({ where: { eventId: second.id } }),
      2,
    );
    assert.deepEqual(
      (
        await prisma.eventRevision.findUniqueOrThrow({
          where: { id: legacyRevision.id },
        })
      ).snapshot,
      v2,
    );
    signal.throwIfAborted();
    results.push(
      "v1/v2/v3 compatibility, v2-to-v3 same-version publication and unchanged history/rejection titles",
    );

    // Real DB races: let attach wait on a media lock, commit DELETING, then ensure
    // attachment refuses it. Opposite ordering is exercised by referenced GC.
    const raceAsset = await uploadEventCover(owner.id, event.id, request());
    const currentEvent = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    let locked = () => {};
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    let releaseLock = () => {};
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const deletionClaim = prisma.$transaction(
      async (tx) => {
        await lockMediaAsset(tx, raceAsset.assetId);
        locked();
        await release;
        await tx.mediaAsset.update({
          where: { id: raceAsset.assetId },
          data: { state: "DELETING", deletingAt: new Date() },
        });
      },
      { timeout: 15000 },
    );
    // A failed lock acquisition must not leave this barrier pending forever.
    await Promise.race([acquired, deletionClaim]);
    const waitingAttachment = attachEventCover(owner.id, event.id, {
      assetId: raceAsset.assetId,
      alt: null,
      version: version(currentEvent),
    });
    const refused = assert.rejects(
      waitingAttachment,
      /unavailable for attachment/,
    );
    await delay(50);
    releaseLock();
    await deletionClaim;
    await refused;
    const old = new Date(Date.now() - 10 * uploadLifetimeMs);
    const oldExpiry = new Date(old.getTime() + uploadLifetimeMs);
    await prisma.mediaAsset.updateMany({
      where: { id: { in: [cover.assetId, replacement.assetId] } },
      data: {
        createdAt: old,
        uploadExpiresAt: oldExpiry,
        readyAt: old,
        unusedSince: old,
      },
    });
    const cleanup = await cleanupMedia();
    assert.equal(cleanup.failed, 0);
    assert.equal(
      await prisma.mediaAsset.count({
        where: { id: { in: [cover.assetId, replacement.assetId] } },
      }),
      2,
    );
    assert.equal(
      await prisma.mediaAsset.count({ where: { id: raceAsset.assetId } }),
      0,
    );
    const unused = await uploadEventCover(owner.id, event.id, request());
    assert.equal((await cleanupMedia()).deleted, 0);
    await prisma.mediaAsset.update({
      where: { id: unused.assetId },
      data: {
        createdAt: old,
        uploadExpiresAt: oldExpiry,
        readyAt: old,
        unusedSince: old,
      },
    });
    assert.equal((await cleanupMedia()).deleted, 1);
    const pendingEvent = await createEvent();
    const pendingRows = await Promise.all(
      Array.from({ length: 9 }, () =>
        prisma.mediaAsset.create({
          data: {
            eventId: pendingEvent.id,
            organizerId: organizer.id,
            storageKey: randomBytes(16).toString("hex"),
            uploadExpiresAt: end,
          },
        }),
      ),
    );
    // One of two concurrent reservations wins the final pending slot.
    const quotaResults = await Promise.allSettled([
      uploadEventCover(owner.id, event.id, request()),
      uploadEventCover(owner.id, second.id, request()),
    ]);
    assert.equal(
      quotaResults.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      quotaResults.filter(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof MediaError &&
          result.reason.status === 429,
      ).length,
      1,
    );
    await prisma.mediaAsset.updateMany({
      where: { id: { in: pendingRows.map((row) => row.id) } },
      data: { createdAt: old, uploadExpiresAt: oldExpiry },
    });
    assert.equal((await cleanupMedia()).deleted, 9);

    // Crash after atomic file publication but before temporary-link removal.
    const interrupted = await prisma.mediaAsset.create({
      data: {
        eventId: pendingEvent.id,
        organizerId: organizer.id,
        storageKey: randomBytes(16).toString("hex"),
        createdAt: old,
        uploadExpiresAt: oldExpiry,
      },
    });
    const interruptedTemp = path.join(
      root,
      `${interrupted.storageKey}.${randomUUID()}.tmp`,
    );
    await writeFile(interruptedTemp, png);
    await link(
      interruptedTemp,
      path.join(root, `${interrupted.storageKey}.640.webp`),
    );
    await utimes(interruptedTemp, old, old);
    assert.equal((await cleanupMedia()).deleted, 1);
    const orphan = randomBytes(16).toString("hex");
    const orphanFile = path.join(root, `${orphan}.${randomUUID()}.tmp`);
    await writeFile(orphanFile, png);
    await utimes(orphanFile, old, old);
    assert.equal((await cleanupMedia()).orphans, 1);
    assert.equal((await cleanupMedia()).orphans, 0);
    assert.equal(await readFile(outsideFile, "utf8"), "keep");
    signal.throwIfAborted();
    results.push(
      "real media-lock race, referenced retention, seven-day grace, concurrent 10-upload quota, 24-hour expiry, interrupted deletion/temp/orphan reconciliation and idempotence",
    );

    // Fixed candidate budget and continuation: 0, batch+1, then 1, then 0.
    assert.equal((await cleanupMedia()).candidates, 0);
    await prisma.mediaAsset.createMany({
      data: Array.from({ length: mediaCleanupBudget.assets + 1 }, () => ({
        organizerId: organizer.id,
        eventId: pendingEvent.id,
        storageKey: randomBytes(16).toString("hex"),
        createdAt: old,
        uploadExpiresAt: oldExpiry,
      })),
    });
    const firstBatch = await cleanupMedia();
    assert.equal(firstBatch.candidates, mediaCleanupBudget.assets);
    assert.equal(firstBatch.deleted, mediaCleanupBudget.assets);
    assert.equal(firstBatch.dbBudgetReached, true);
    const lastBatch = await cleanupMedia();
    assert.equal(lastBatch.deleted, 1);
    assert.equal(lastBatch.dbBudgetReached, false);
    assert.equal((await cleanupMedia()).deleted, 0);

    // Both collectors claim the same DELETING row before either removes files.
    const concurrentAsset = await prisma.mediaAsset.create({
      data: {
        organizerId: organizer.id,
        eventId: pendingEvent.id,
        storageKey: randomBytes(16).toString("hex"),
        state: "DELETING",
        createdAt: old,
        uploadExpiresAt: oldExpiry,
        deletingAt: old,
      },
    });
    const originalRemove = storage.remove;
    let arrivals = 0;
    let releaseCollectors = () => {};
    let collectorTimer: ReturnType<typeof setTimeout> | undefined;
    const bothCollectors = new Promise<void>((resolve, reject) => {
      releaseCollectors = resolve;
      collectorTimer = setTimeout(
        () => reject(new Error("Collector barrier timed out")),
        5000,
      );
    });
    storage.remove = async (key) => {
      if (key === concurrentAsset.storageKey) {
        arrivals += 1;

        if (arrivals === 2) {
          clearTimeout(collectorTimer);
          releaseCollectors();
        }

        await bothCollectors;
      }

      return originalRemove(key);
    };

    try {
      const collectors = await Promise.all([cleanupMedia(), cleanupMedia()]);
      assert.equal(arrivals, 2);
      assert.equal(
        collectors.reduce((sum, result) => sum + result.deleted, 0),
        1,
      );
      assert.equal(
        collectors.reduce((sum, result) => sum + result.failed, 0),
        0,
      );
    } finally {
      storage.remove = originalRemove;
      clearTimeout(collectorTimer);
      releaseCollectors();
    }

    // Interrupted partial deletion: retain the row, then retry successfully.
    const recovery = await prisma.mediaAsset.create({
      data: {
        organizerId: organizer.id,
        eventId: pendingEvent.id,
        storageKey: randomBytes(16).toString("hex"),
        createdAt: old,
        uploadExpiresAt: oldExpiry,
      },
    });
    await storage.write(recovery.storageKey, "640", png);
    const unsafeVariant = path.join(root, `${recovery.storageKey}.1280.webp`);
    await symlink(outsideFile, unsafeVariant);
    await assert.rejects(cleanupMedia(), /Unsafe media file/);
    assert.equal(
      (
        await prisma.mediaAsset.findUniqueOrThrow({
          where: { id: recovery.id },
        })
      ).state,
      "DELETING",
    );
    assert.equal(await readFile(outsideFile, "utf8"), "keep");
    await assert.rejects(storage.read(recovery.storageKey, "640"));
    await unlink(unsafeVariant);
    assert.equal((await cleanupMedia()).deleted, 1);

    // Orphan file budget is independent of the DB candidate budget.
    for (let index = 0; index <= mediaCleanupBudget.orphanFiles; index += 1) {
      signal.throwIfAborted();
      const file = path.join(
        root,
        `${randomBytes(16).toString("hex")}.${randomUUID()}.tmp`,
      );
      await writeFile(file, "isolated orphan");
      await utimes(file, old, old);
    }

    const orphanBatch = await cleanupMedia();
    assert.equal(orphanBatch.orphans, mediaCleanupBudget.orphanFiles);
    assert.equal(orphanBatch.orphanBudgetReached, true);
    assert.equal((await cleanupMedia()).orphans, 1);
    assert.equal((await cleanupMedia()).orphans, 0);

    // Old files referenced only by historical revisions survive reconciliation too.
    for (const assetId of [cover.assetId, replacement.assetId]) {
      const asset = await prisma.mediaAsset.findUniqueOrThrow({
        where: { id: assetId },
      });
      const file = path.join(root, `${asset.storageKey}.640.webp`);
      await utimes(file, old, old);
      assert.ok((await storage.read(asset.storageKey, "640")).length > 0);
    }

    const retainedHistory = await cleanupMedia();
    assert.equal(retainedHistory.deleted, 0);
    assert.equal(retainedHistory.orphans, 0);

    // Admission quota is not a detach prohibition. Use a separate organizer so
    // these pending uploads cannot affect the remainder of the original checks.
    const quotaCover = await uploadEventCover(
      foreign.id,
      foreignEvent.id,
      request(foreign.id),
    );
    const quotaAttached = await attachEventCover(foreign.id, foreignEvent.id, {
      assetId: quotaCover.assetId,
      alt: null,
      version: version(foreignEvent),
    });
    await prisma.mediaAsset.createMany({
      data: Array.from({ length: 10 }, () => ({
        organizerId: otherOrganizer.id,
        eventId: foreignEvent.id,
        storageKey: randomBytes(16).toString("hex"),
        createdAt: old,
        uploadExpiresAt: oldExpiry,
      })),
    });
    const detachAndAdmission = await Promise.allSettled([
      attachEventCover(foreign.id, foreignEvent.id, {
        assetId: null,
        alt: null,
        version: quotaAttached.version,
      }),
      uploadEventCover(foreign.id, foreignEvent.id, request(foreign.id)),
    ]);
    assert.equal(detachAndAdmission[0].status, "fulfilled");
    assert.equal(detachAndAdmission[1].status, "rejected");

    if (detachAndAdmission[1].status === "rejected") {
      assert.equal(detachAndAdmission[1].reason.status, 429);
    }

    assert.equal(
      await prisma.mediaAsset.count({
        where: {
          organizerId: otherOrganizer.id,
          OR: [
            { state: "UPLOADING" },
            {
              state: "READY",
              draftEvents: { none: {} },
              revisions: { none: {} },
            },
          ],
        },
      }),
      11,
    );
    await assert.rejects(
      uploadEventCover(foreign.id, foreignEvent.id, request(foreign.id)),
      (error: unknown) => error instanceof MediaError && error.status === 429,
    );
    assert.equal((await cleanupMedia()).deleted, 10);
    await uploadEventCover(foreign.id, foreignEvent.id, request(foreign.id));
    signal.throwIfAborted();
    results.push(
      "unsafe ancestor/symlink rejection; cleanup 0/1/101 budgets and continuation; concurrent collectors counted once; interrupted DELETING recovery; 101 orphan files; historical retention; concurrent detach/admission above ten and admission after cleanup",
    );

    const beforeFailure = await prisma.mediaAsset.count();
    process.env.MEDIA_STORAGE_ROOT = path.join(root, "missing");
    await assert.rejects(uploadEventCover(owner.id, event.id, request()));
    process.env.MEDIA_STORAGE_ROOT = root;
    assert.equal(await prisma.mediaAsset.count(), beforeFailure + 1);
    const failed = await prisma.mediaAsset.findFirstOrThrow({
      where: { state: "UPLOADING", eventId: event.id },
    });
    await prisma.mediaAsset.update({
      where: { id: failed.id },
      data: { createdAt: old, uploadExpiresAt: oldExpiry },
    });
    assert.equal((await cleanupMedia()).deleted, 1);
    const draftEvent = await createEvent();
    const draftAsset = await uploadEventCover(
      owner.id,
      draftEvent.id,
      request(),
    );
    await attachEventCover(owner.id, draftEvent.id, {
      assetId: draftAsset.assetId,
      alt: null,
      version: version(draftEvent),
    });
    assert.equal(
      (
        await changeOwnedEventLifecycle(organizer.id, {
          eventId: draftEvent.id,
          action: "delete",
        })
      ).deleted,
      true,
    );
    const releasedAsset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: draftAsset.assetId },
    });
    assert.equal(releasedAsset.eventId, null);
    assert.ok(releasedAsset.unusedSince);
    await assert.rejects(
      attachEventCover(foreign.id, foreignEvent.id, {
        assetId: draftAsset.assetId,
        alt: null,
        version: version(foreignEvent),
      }),
    );

    // Cancellation is modeled directly here to avoid generating any mail intent.
    const reattachedEvent = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    const again = await attachEventCover(owner.id, event.id, {
      assetId: replacement.assetId,
      alt: null,
      version: version(reattachedEvent),
    });
    await publishOwnedEvent(organizer.id, {
      eventId: event.id,
      contentVersion: again.contentVersion,
    });
    await prisma.event.update({
      where: { id: event.id },
      data: {
        cancelledAt: new Date(),
        cancellationReason: "Isolated verification",
      },
    });
    assert.equal(
      (
        await serveEventMedia(
          new Request(`${origin}/public`),
          replacementPublic,
        )
      ).status,
      200,
    );
    await assert.rejects(
      uploadEventCover(owner.id, event.id, request()),
      /read-only/,
    );
    assert.equal(
      (
        await changeOwnedEventLifecycle(organizer.id, {
          eventId: event.id,
          action: "archive",
        })
      ).success,
      true,
    );
    assert.equal(
      (
        await serveEventMedia(
          new Request(`${origin}/public`),
          replacementPublic,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await changeOwnedEventLifecycle(organizer.id, {
          eventId: event.id,
          action: "restore",
        })
      ).success,
      true,
    );
    const badJson = new Request(`${origin}/cover`, {
      method: "PUT",
      headers: {
        origin,
        cookie: cookies.get(owner.id) ?? "",
        "content-type": "application/json",
      },
      body: "{",
    });
    assert.equal((await PUT(badJson, context)).status, 400);
    assert.equal(await prisma.emailOutbox.count(), 0);
    signal.throwIfAborted();
    results.push(
      "failed filesystem write remains recoverable, pristine draft delete, no cross-owner reuse, cancellation/archive/restore semantics and no mail intents",
    );

    // Verify the actual maintenance entrypoint ONLY against these disposable
    // resources. Never invoke it with the original application DB/storage pair.
    assert.match(databaseName, /^event_flow_verify_29a_[a-f0-9]{32}$/);
    assert.ok(path.basename(root).startsWith("event-flow-verify-29a-"));
    signal.throwIfAborted();
    const maintenance = await runMaintenance([
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/media-cleanup.ts",
    ]);
    signal.throwIfAborted();
    assert.match(maintenance.stdout, /Media cleanup:/);
    results.push(
      "maintenance CLI executed only against the isolated verification DB and media root",
    );

    for (const result of results) {
      console.log(`PASS: ${result}`);
    }
  } catch (error) {
    failures.push(
      error instanceof Error && error.name === "AbortError" && signal.aborted
        ? signal.reason
        : error,
    );
  } finally {
    // Exercise reporting/continuation without preventing actual resource removal.
    if (process.argv.includes("--cleanup-failure")) {
      await boundedCleanup(
        [
          {
            name: "injected failure",
            run: async () => {
              throw new Error("Injected cleanup failure");
            },
          },
          {
            name: "injected timeout",
            run: () =>
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Late cleanup rejection")),
                  50,
                ),
              ),
          },
        ],
        failures,
        20,
      );
      await delay(60);
    }
    await boundedCleanup(
      [
        {
          name: "maintenance child",
          run: () => stopVerificationServer(maintenanceChild),
        },
        { name: "Prisma disconnect", run: async () => db?.$disconnect() },
        { name: "SQL disconnect", run: async () => connection?.end() },
        {
          name: "verification database removal",
          run: async () => {
            if (created) {
              assert.match(
                databaseName,
                /^event_flow_verify_29a_[a-f0-9]{32}$/,
              );
              assert.notEqual(
                databaseName,
                new URL(originalUrl).pathname.slice(1),
              );
              await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
            }
          },
        },
        { name: "admin disconnect", run: async () => admin.end() },
        {
          name: "verification media removal",
          run: async () => {
            if (root) {
              assert.equal(
                path.dirname(root),
                path.join(homedir(), "Library", "Application Support"),
              );
              assert.ok(
                path.basename(root).startsWith("event-flow-verify-29a-"),
              );
              assert.notEqual(root, originalRoot);
              await rm(root, { recursive: true, force: true });
            }
          },
        },
      ],
      failures,
    );

    process.env.DATABASE_URL = originalUrl;

    if (originalRoot === undefined) {
      delete process.env.MEDIA_STORAGE_ROOT;
    } else {
      process.env.MEDIA_STORAGE_ROOT = originalRoot;
    }

    if (signal.aborted && !failures.includes(signal.reason)) {
      failures.push(signal.reason);
    }
    control.dispose();
  }

  if (failures.length) {
    console.error(
      JSON.stringify({
        database: databaseName,
        root,
        childPid: maintenanceChild?.pid,
      }),
    );
    throw new AggregateError(
      failures,
      "29A verification failed; all cleanup steps attempted",
      { cause: failures[0] },
    );
  }

  console.log(
    "29A checks passed; isolated database and media removed; no persistent fixtures or SMTP.",
  );
}

// Cleanup has finished or timed out; failed drivers must not keep the CLI alive.
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
