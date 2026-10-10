// Requested 29C HTTP verification. Disposable DB/media and production server only.
// No dispatcher, SMTP, writes to the development DB, or persistent fixtures.
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import sharp from "sharp";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { Prisma } from "@/generated/prisma/client";
import {
  boundedCleanup,
  stopVerificationServer,
  verificationControl,
  verificationInput,
} from "./public-event-verification-cleanup";

async function main() {
  if (process.argv.includes("--browser") && !process.stdin.isTTY) {
    throw new Error(
      "Browser verification requires an interactive terminal for cleanup.",
    );
  }
  loadEnvConfig(process.cwd(), true);
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl);
  const url = new URL(originalUrl);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  const name = `event_flow_verify_29c_${randomUUID().replaceAll("-", "")}`;
  const origin = "http://127.0.0.1:3039";
  const admin = new Client({
    connectionString: originalUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10_000,
    query_timeout: 15_000,
  });
  let connection: Client | undefined;
  let db: typeof import("@/lib/prisma")["prisma"] | undefined;
  let server: ChildProcess | undefined;
  let created = false;
  let root: string | undefined;
  const failures: unknown[] = [];
  let serverLog = "";
  const control = verificationControl(
    process.argv.includes("--browser") ? 600_000 : 120_000,
  );
  const { signal } = control;
  const request: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
  async function checkpoint(stage: string) {
    signal.throwIfAborted();

    if (process.argv.includes(`--cleanup-probe=${stage}`)) {
      console.log(
        JSON.stringify({
          checkpoint: stage,
          database: name,
          root,
          serverPid: server?.pid,
        }),
      );
      await delay(30_000, undefined, { signal });
      throw new Error("Cleanup probe did not receive a signal");
    }
  }

  try {
    signal.throwIfAborted();
    await admin.connect();
    signal.throwIfAborted();
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    created = true;
    await checkpoint("database");
    url.pathname = `/${name}`;
    url.searchParams.set(
      "options",
      "-c statement_timeout=10000 -c lock_timeout=5000",
    );
    process.env.DATABASE_URL = url.toString();
    process.env.BETTER_AUTH_URL = origin;
    process.env.SMTP_PORT = "1";
    connection = new Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
      query_timeout: 15_000,
    });
    await connection.connect();
    assert.equal(
      (await connection.query("SELECT current_database() AS name")).rows[0]
        .name,
      name,
    );

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
    signal.throwIfAborted();
    root = await mkdtemp(
      path.join(
        homedir(),
        "Library",
        "Application Support",
        "event-flow-verify-29c-",
      ),
    );
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
      name,
    );
    const { publishOwnedEvent } = await import(
      "@/features/events/server/publish-event"
    );
    const { normalizeImage } = await import(
      "@/features/events/server/media-image"
    );
    const { mediaStorage } = await import("@/lib/media-storage");
    const { auth } = await import("@/lib/auth");
    const owner = await prisma.user.create({
      data: {
        name: "PRIVATE_OWNER_NAME",
        email: "private-owner@example.test",
        emailVerified: true,
      },
    });
    const applicant = await prisma.user.create({
      data: {
        name: "Linked applicant",
        email: "applicant@example.test",
        emailVerified: true,
      },
    });
    const organizer = await prisma.organizerProfile.create({
      data: { userId: owner.id },
    });
    const cookieName = (await auth.$context).authCookies.sessionToken.name;
    async function cookieFor(userId: string) {
      const token = randomBytes(32).toString("hex");
      await prisma.session.create({
        data: { userId, token, expiresAt: new Date(Date.now() + 3600000) },
      });
      const signature = createHmac(
        "sha256",
        process.env.BETTER_AUTH_SECRET ?? "",
      )
        .update(token)
        .digest("base64");

      return `${cookieName}=${encodeURIComponent(`${token}.${signature}`)}`;
    }
    const ownerCookie = await cookieFor(owner.id);
    const applicantCookie = await cookieFor(applicant.id);
    const startsAt = new Date("2030-10-26T08:00:00.000Z");
    const endsAt = new Date("2030-10-28T10:00:00.000Z");
    async function event(data: Partial<Prisma.EventUncheckedCreateInput> = {}) {
      signal.throwIfAborted();

      return prisma.event.create({
        data: {
          organizerId: organizer.id,
          title: "Berlin Open Studio",
          startsAt,
          endsAt,
          timezone: "Europe/Berlin",
          visibility: "PUBLIC",
          capacity: 1,
          descriptionFormat: "MARKDOWN",
          description:
            "# A weekend of ideas\n\nMeet the community, share **new perspectives** and [explore together](https://example.test/private-destination).\n\n<script>NEVER_RENDER_SCRIPT</script>",
          location: {
            type: "HYBRID",
            venueName: "Riverside Studio",
            address: "12 River Street, Berlin",
            onlineLabel: "Join online",
            onlineUrl: "https://example.test/join",
          },
          publicOrganizer: {
            displayName: "Open Studio Collective",
            description: "Ideas, conversations and a shared space to create.",
            websiteUrl: "https://example.test",
          },
          schedule: [
            {
              title: "Doors open",
              description: "Meet your hosts and settle in.",
              startsAt: "2030-10-26T08:00:00.123Z",
            },
            {
              title: "First conversation",
              description: null,
              startsAt: "2030-10-27T00:30:00.123Z",
            },
            {
              title: "Parallel conversation",
              description: null,
              startsAt: "2030-10-27T00:30:00.123Z",
            },
            {
              title: "Second conversation",
              description: null,
              startsAt: "2030-10-27T01:30:00.456Z",
            },
          ],
          ...data,
          registrationForm: { create: {} },
        },
      });
    }
    async function publish(id: string) {
      signal.throwIfAborted();
      const row = await prisma.event.findUniqueOrThrow({ where: { id } });
      assert.deepEqual(
        await publishOwnedEvent(organizer.id, {
          eventId: id,
          contentVersion: row.contentVersion,
        }),
        { success: true },
      );

      return prisma.event.findUniqueOrThrow({
        where: { id },
        include: { publishedRevision: true },
      });
    }
    const rich = await event();
    const png = await sharp({
      create: { width: 1600, height: 650, channels: 3, background: "#645080" },
    })
      .png()
      .toBuffer();
    const normalized = await normalizeImage(png, "image/png");
    const key = randomBytes(16).toString("hex");
    const mediaCreatedAt = new Date();
    const storage = mediaStorage("LOCAL");

    for (const [variant, bytes] of normalized.variants) {
      await storage.write(key, variant, bytes);
    }
    const asset = await prisma.mediaAsset.create({
      data: {
        organizerId: organizer.id,
        eventId: rich.id,
        storageKey: key,
        state: "READY",
        manifest: normalized.manifest,
        uploadExpiresAt: endsAt,
        createdAt: mediaCreatedAt,
        readyAt: mediaCreatedAt,
      },
    });
    await prisma.event.update({
      where: { id: rich.id },
      data: { coverAssetId: asset.id, coverAlt: "Open studio cover" },
    });
    const published = await publish(rich.id);
    assert.ok(published.publicId && published.publishedRevision);
    const initial = eventSnapshotSchema.parse(
      published.publishedRevision.snapshot,
    );
    const cases = new Map<string, string>([["rich", published.publicId]]);
    const neverPublished = await event({ title: "NEVER_PUBLISHED_SECRET" });
    cases.set("never-published", neverPublished.id);
    for (const version of [1, 2]) {
      const row = await event({ title: `Legacy V${version}` });
      const snapshot = {
        schemaVersion: version,
        title: `Legacy V${version}`,
        description: "**Literal legacy text**",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: "Europe/Berlin",
        visibility: "PUBLIC",
        accountRequirement: "OPTIONAL",
        capacity: null,
        registrationOpensAt: null,
        registrationClosesAt: null,
        registrationForm: { fields: [] },
        ...(version === 2 ? { maxGuestsPerRegistration: 0 } : {}),
      };
      assert.ok(eventSnapshotSchema.safeParse(snapshot).success);
      const revision = await prisma.eventRevision.create({
        data: {
          eventId: row.id,
          number: 1,
          contentVersion: 1,
          publishedAt: new Date(),
          snapshot,
        },
      });
      const publicId = randomUUID();
      await prisma.event.update({
        where: { id: row.id },
        data: {
          publicId,
          publishedRevisionId: revision.id,
          publishedAt: new Date(),
        },
      });
      cases.set(`v${version}`, publicId);
    }
    for (const [label, data] of [
      ["navigation", { title: "Navigation check" }],
      ["required", { accountRequirement: "REQUIRED" }],
      ["private", { visibility: "PRIVATE" }],
      ["not-open", { registrationOpensAt: new Date("2030-10-25") }],
      ["closed", { registrationClosesAt: new Date("2020-01-01") }],
      [
        "long",
        {
          title: "A day of conversations, creative work and shared discoveries",
          description: Array.from(
            { length: 12 },
            (_, index) =>
              `## Conversation ${index + 1}\n\n${"A welcoming space to share ideas, learn from each other and explore new perspectives. ".repeat(5)}\n\n${"unbrokentext".repeat(30)}`,
          ).join("\n\n"),
        },
      ],
      [
        "empty",
        {
          description: null,
          location: Prisma.DbNull,
          publicOrganizer: Prisma.DbNull,
          schedule: [],
        },
      ],
    ] satisfies [string, Partial<Prisma.EventUncheckedCreateInput>][]) {
      const row = await event(data);
      const result = await publish(row.id);
      assert.ok(result.publicId);
      cases.set(label, result.publicId);
    }
    // Historical terminal fixtures preserve a valid snapshot; no lifecycle action/email.
    for (const label of [
      "ongoing",
      "completed",
      "cancelled",
      "archived",
      "invalid",
      "unpublished",
    ]) {
      const row = await event();
      const result = await publish(row.id);
      assert.ok(result.publicId && result.publishedRevision);
      cases.set(label, result.publicId);

      if (label === "cancelled") {
        await prisma.event.update({
          where: { id: row.id },
          data: {
            cancelledAt: new Date(),
            cancellationReason: "Venue unavailable",
          },
        });
      } else if (label === "unpublished") {
        await prisma.event.update({
          where: { id: row.id },
          data: { publishedRevisionId: null },
        });
      } else if (label === "invalid") {
        await prisma.eventRevision.update({
          where: { id: result.publishedRevision.id },
          data: { snapshot: { schemaVersion: 999, title: "INVALID_SECRET" } },
        });
      } else {
        const start = new Date(Date.now() - 7200000);
        const end = new Date(
          Date.now() + (label === "ongoing" ? 7200000 : -3600000),
        );
        const snapshot = {
          ...initial,
          cover: null,
          schedule: [],
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        };
        await prisma.eventRevision.update({
          where: { id: result.publishedRevision.id },
          data: { snapshot },
        });
        await prisma.event.update({
          where: { id: row.id },
          data: {
            startsAt: start,
            endsAt: end,
            archivedAt: label === "archived" ? new Date() : null,
          },
        });
      }
    }
    async function page(
      label: string,
      cookie = "",
      userAgent = "Mozilla/5.0",
      expected = 200,
    ) {
      const id = cases.get(label) ?? label;
      const response = await request(`${origin}/e/${id}`, {
        headers: {
          cookie,
          "user-agent": userAgent,
          host: "untrusted.invalid",
          "x-forwarded-host": "untrusted.invalid",
        },
      });
      const html = await response.text();
      assert.equal(
        response.status,
        expected,
        `${label}: HTTP ${response.status}`,
      );
      assert.doesNotMatch(
        html,
        /PRIVATE_OWNER_NAME|private-owner@example.test|INVALID_SECRET|DRAFT_SECRET|NEVER_PUBLISHED_SECRET|NEVER_RENDER_SCRIPT/,
      );
      assert.ok(!html.includes(key));

      return html;
    }
    signal.throwIfAborted();
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--port",
        "3039",
        "--hostname",
        "127.0.0.1",
      ],
      {
        env: { ...process.env, NODE_ENV: "production" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.on("error", (error) => control.abort(error));
    server.on("exit", (code, exitSignal) => {
      control.abort(
        new Error(
          `Verification server exited unexpectedly: ${code ?? exitSignal}`,
        ),
      );
    });
    await checkpoint("server");
    server.stdout?.on("data", (data) => {
      serverLog = (serverLog + data).slice(-12000);
    });
    server.stderr?.on("data", (data) => {
      serverLog = (serverLog + data).slice(-12000);
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      assert.equal(server.exitCode, null, serverLog);
      try {
        await request(`${origin}/e/invalid`);
        ready = true;
        break;
      } catch {
        signal.throwIfAborted();
        await delay(100, undefined, { signal });
      }
    }
    assert.ok(ready, serverLog);
    for (const agent of [
      "Mozilla/5.0",
      "Googlebot",
      "Twitterbot",
      "facebookexternalhit",
    ]) {
      for (const label of [
        "invalid",
        "unpublished",
        "never-published",
        randomUUID(),
        "malformed-id",
      ]) {
        const html = await page(label, "", agent, 404);
        assert.doesNotMatch(
          html,
          /property="og:|name="twitter:|rel="canonical"/,
        );
      }
    }
    console.log(
      "PASS: HTML HTTP 404 for malformed/missing/unpublished/invalid publications across browser and crawler user agents",
    );
    // A real catalog router tree: this exercises navigation Flight responses,
    // rather than treating the RSC transport status as document availability.
    const routerTree = [
      "",
      {
        children: [
          "e",
          { children: ["(catalog)", { children: ["__PAGE__", {}] }] },
        ],
      },
      null,
      null,
      1,
    ];
    for (const label of [
      "rich",
      "invalid",
      "unpublished",
      "never-published",
      randomUUID(),
      "malformed-id",
    ]) {
      const response = await request(
        `${origin}/e/${cases.get(label) ?? label}`,
        {
          headers: {
            RSC: "1",
            "Next-Router-State-Tree": encodeURIComponent(
              JSON.stringify(routerTree),
            ),
            "Next-Url": "/e",
          },
        },
      );
      const payload = await response.text();
      assert.match(
        response.headers.get("content-type") ?? "",
        /text\/x-component/,
      );
      assert.doesNotMatch(
        payload,
        /PRIVATE_OWNER_NAME|private-owner@example.test|INVALID_SECRET|DRAFT_SECRET|NEVER_PUBLISHED_SECRET|NEVER_RENDER_SCRIPT/,
      );
      assert.ok(!payload.includes(key));

      if (label === "rich") {
        assert.equal(response.status, 200);
        assert.match(payload, /Berlin Open Studio/);
        assert.doesNotMatch(payload, /NEXT_HTTP_ERROR_FALLBACK;404/);
      } else {
        assert.ok(response.status === 200 || response.status === 404);
        assert.match(payload, /NEXT_HTTP_ERROR_FALLBACK;404/);
        assert.doesNotMatch(
          payload,
          /Berlin Open Studio|event-application|Open Studio Collective/,
        );
      }
    }
    console.log(
      "PASS: RSC navigation Not Found signal, valid publication and protected-content exclusion",
    );
    for (const version of [1, 2]) {
      const html = await page(`v${version}`);
      assert.match(html, /\*\*Literal legacy text\*\*/);
      assert.doesNotMatch(
        html,
        /event-location-title|event-schedule-title|event-organizer-title/,
      );
    }
    const html = await page("rich");
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /02:30 GMT\+2/);
    assert.match(html, /02:30 GMT\+1/);
    assert.match(
      html,
      /name="description" content="A weekend of ideas Meet the community, share new perspectives and explore together\."/,
    );
    assert.match(html, /name="robots" content="index, follow"/);
    assert.ok(
      html.includes(`rel="canonical" href="${origin}/e/${published.publicId}"`),
    );
    assert.ok(html.includes(`${asset.id}/social`));
    assert.match(html, /640w.*1280w.*1600w/);
    assert.match(html, /name="fullName"/);
    assert.doesNotMatch(
      await page("empty"),
      /<img|event-description-title|event-location-title|event-schedule-title|event-organizer-title/,
    );
    const longHtml = await page("long");
    assert.match(longHtml, /Conversation 12/);
    const longDescription = longHtml.match(
      /name="description" content="([^"]*)"/,
    );
    assert.ok(longDescription);
    assert.equal(longDescription[1].length, 160);
    const privateHtml = await page("private");
    assert.match(privateHtml, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(privateHtml, /property="og:|name="twitter:/);
    for (const label of ["cancelled", "archived"]) {
      const content = await page(label);
      assert.match(content, /name="robots" content="noindex, follow"/);
      assert.doesNotMatch(content, /name="fullName"|href="#event-application"/);
    }
    assert.match(
      await page("completed"),
      /name="robots" content="index, follow"/,
    );
    assert.match(await page("ongoing"), /Happening now/);
    for (const label of ["completed", "closed", "not-open"]) {
      assert.doesNotMatch(
        await page(label),
        /name="fullName"|href="#event-application"/,
      );
    }
    assert.match(await page("required"), /Sign in to apply/);
    assert.doesNotMatch(await page("required"), /name="fullName"/);
    assert.match(await page("required", applicantCookie), /name="fullName"/);
    // Anonymous content never inherits the signed-in account response.
    assert.doesNotMatch(await page("required"), /applicant@example.test/);
    const applied = await prisma.application.create({
      data: {
        eventId: rich.id,
        eventRevisionId: published.publishedRevision.id,
        userId: applicant.id,
        fullName: applicant.name,
        email: applicant.email,
      },
    });
    assert.match(
      await page("rich", applicantCookie),
      /Your application:.*Pending/,
    );
    assert.doesNotMatch(await page("rich", applicantCookie), /name="fullName"/);
    for (const status of ["REJECTED", "WITHDRAWN"] as const) {
      await prisma.application.update({
        where: { id: applied.id },
        data: {
          status,
          reviewedAt: new Date(),
          withdrawnAt: status === "WITHDRAWN" ? new Date() : null,
        },
      });
      const content = await page("rich", applicantCookie);
      assert.equal(content.includes('name="fullName"'), status === "WITHDRAWN");
      assert.equal(content.includes("Apply again"), status === "WITHDRAWN");
      assert.match(content, /View application history/);
    }
    await prisma.application.update({
      where: { id: applied.id },
      data: { status: "APPROVED", withdrawnAt: null },
    });
    const registration = await prisma.registration.create({
      data: {
        eventId: rich.id,
        sourceApplicationId: applied.id,
        userId: applicant.id,
        attendeeName: applicant.name,
        attendeeEmail: applicant.email,
        attendees: {
          create: {
            kind: "PRIMARY",
            name: applicant.name,
            email: applicant.email,
            userId: applicant.id,
          },
        },
      },
      include: { attendees: true },
    });
    const { issueTicket } = await import(
      "@/features/tickets/server/issue-ticket"
    );
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${rich.id}::uuid FOR UPDATE`;
      await issueTicket(tx, registration.attendees[0]);
    });
    assert.match(await page("rich", applicantCookie), /Registration confirmed/);
    const full = await page("rich");
    assert.match(full, /All places are currently filled. You can still apply/);
    assert.match(full, /name="fullName"/);
    console.log(
      "PASS: V1/V2/V3, rich metadata/robots, PRIVATE and terminal states, account requirement, application/reapply/admission/history and full capacity CTA",
    );
    const coverUrl = `${origin}/e/${published.publicId}/cover/${asset.id}`;
    const media = await request(`${coverUrl}/social`);
    assert.equal(media.status, 200);
    assert.match(media.headers.get("cache-control") ?? "", /private, no-store/);
    assert.equal(media.headers.get("x-content-type-options"), "nosniff");
    assert.match(media.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal(media.headers.get("content-type"), "image/jpeg");
    const draft = await prisma.event.update({
      where: { id: rich.id },
      data: {
        title: "DRAFT_SECRET",
        description: "DRAFT_SECRET",
        contentVersion: { increment: 1 },
      },
    });
    assert.match(await page("rich"), /Berlin Open Studio/);
    const preview = await request(
      `${origin}/dashboard/events/${rich.id}/preview`,
      { headers: { cookie: ownerCookie } },
    );
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), /DRAFT_SECRET/);
    await prisma.event.update({
      where: { id: rich.id },
      data: {
        title: "Republished studio",
        description: "Updated published description",
        coverAssetId: null,
        coverAlt: null,
      },
    });
    assert.deepEqual(
      await publishOwnedEvent(organizer.id, {
        eventId: rich.id,
        contentVersion: draft.contentVersion,
      }),
      { success: true },
    );
    assert.match(
      await page("rich"),
      /<title>Republished studio \| Event Flow<\/title>/,
    );
    assert.equal((await request(`${coverUrl}/social`)).status, 404);
    await prisma.event.update({
      where: { id: rich.id },
      data: { publishedRevisionId: published.publishedRevision.id },
    });
    // A separately published asset with absent fixture bytes exercises client fallback.
    const broken = await event({ title: "Cover fallback" });
    const missingAsset = await prisma.mediaAsset.create({
      data: {
        organizerId: organizer.id,
        eventId: broken.id,
        storageKey: randomBytes(16).toString("hex"),
        state: "READY",
        manifest: normalized.manifest,
        uploadExpiresAt: endsAt,
        createdAt: mediaCreatedAt,
        readyAt: mediaCreatedAt,
      },
    });
    await prisma.event.update({
      where: { id: broken.id },
      data: {
        coverAssetId: missingAsset.id,
        coverAlt: "Unavailable fixture cover",
      },
    });
    const brokenPublished = await publish(broken.id);
    assert.ok(brokenPublished.publicId);
    cases.set("broken", brokenPublished.publicId);
    assert.equal(
      (
        await request(
          `${origin}/e/${brokenPublished.publicId}/cover/${missingAsset.id}/1280`,
        )
      ).status,
      503,
    );
    assert.equal(await prisma.emailOutbox.count(), 0);
    console.log(
      "PASS: live cover headers/current-reference enforcement, draft/Preview isolation, republish freshness and no SMTP/outbox writes",
    );

    if (process.argv.includes("--browser")) {
      console.log(`BROWSER catalog: ${origin}/e`);
      console.log(`BROWSER navigation: ${origin}/e/${cases.get("navigation")}`);
      console.log(
        "Open the catalog, then enter unpublish to invalidate only the Navigation check fixture; Enter ends verification.",
      );
      let input = await verificationInput(signal);

      if (input === "unpublish") {
        await prisma.event.update({
          where: { publicId: cases.get("navigation") },
          data: { publishedRevisionId: null },
        });
        console.log(
          "Navigation fixture unpublished. Click its existing catalog link; Enter ends verification.",
        );
        input = await verificationInput(signal);
      }
      assert.equal(input, "", "Unexpected browser verification command");
    }
    signal.throwIfAborted();
  } catch (error) {
    failures.push(error);

    if (serverLog.includes("Error")) console.error(serverLog);
  } finally {
    process.stdin.pause();
    // Ignore child exit as an interruption once intentional teardown has begun.
    server?.removeAllListeners("exit");
    await boundedCleanup(
      [
        { name: "server", run: () => stopVerificationServer(server) },
        { name: "Prisma", run: async () => db?.$disconnect() },
        { name: "fixture connection", run: async () => connection?.end() },
        {
          name: "database",
          run: async () => {
            if (created) {
              assert.match(name, /^event_flow_verify_29c_[a-f0-9]{32}$/);
              await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
              assert.equal(
                (
                  await admin.query(
                    "SELECT 1 FROM pg_database WHERE datname = $1",
                    [name],
                  )
                ).rowCount,
                0,
              );
            }
          },
        },
        { name: "admin connection", run: async () => admin.end() },
        {
          name: "media",
          run: async () => {
            if (root) {
              assert.equal(
                path.dirname(root),
                path.join(homedir(), "Library", "Application Support"),
              );
              assert.ok(
                path.basename(root).startsWith("event-flow-verify-29c-"),
              );
              await rm(root, { recursive: true });
            }
          },
        },
      ],
      failures,
    );

    if (signal.aborted && !failures.includes(signal.reason)) {
      failures.push(signal.reason);
    }
    control.dispose();
  }

  if (failures.length)
    throw new AggregateError(
      failures,
      "29C verification failed; all cleanup steps attempted",
      { cause: failures[0] },
    );
  console.log(
    "PASS: production server stopped; isolated database/media removed; no persistent fixtures or SMTP",
  );
}

// Cleanup deadlines also bound process lifetime if a failed driver keeps handles open.
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
