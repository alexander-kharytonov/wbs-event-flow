// Requested signal/failure checks: only the media verifier's disposable resources.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import {
  boundedCleanup,
  stopVerificationServer,
} from "./public-event-verification-cleanup";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const url = process.env.DATABASE_URL;
  assert.ok(url);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
  );
  const admin = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  await admin.connect();

  try {
    for (const [stage, mode] of [
      ["database", "SIGINT"],
      ["media", "SIGTERM"],
      ["child", "repeated"],
      ["failure", "failure"],
    ] as const) {
      const child = spawn(
        process.execPath,
        [
          "--expose-gc",
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/check-event-media.ts",
          mode === "failure" ? "--cleanup-failure" : `--cleanup-probe=${stage}`,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      const exited = once(child, "exit");
      const failures: unknown[] = [];
      let stdout = "";
      let stderr = "";
      let repeat: ReturnType<typeof setTimeout> | undefined;
      let resource:
        | { database: string; root?: string; childPid?: number }
        | undefined;
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.stdout.on("data", (data) => {
        stdout += data.toString();

        if (resource) {
          return;
        }

        const line = stdout
          .split("\n")
          .slice(0, -1)
          .find((line) => line.startsWith('{"checkpoint":'));

        if (!line) {
          return;
        }

        try {
          resource = JSON.parse(line);

          if (mode !== "failure") {
            child.kill(mode === "repeated" ? "SIGINT" : mode);

            if (mode === "repeated") {
              // The TERM-resistant maintenance child keeps teardown active here.
              repeat = setTimeout(() => {
                child.kill("SIGTERM");
                child.kill("SIGINT");
              }, 100);
            }
          }
        } catch (error) {
          failures.push(error);
          child.kill("SIGTERM");
        }
      });

      try {
        await boundedCleanup(
          [{ name: "probe exit", run: () => exited }],
          failures,
          60_000,
        );
      } finally {
        clearTimeout(repeat);
        await stopVerificationServer(child);
      }

      assert.deepEqual(failures, []);
      assert.ok(resource, stdout + stderr);
      assert.equal(child.exitCode, 1, stderr);
      assert.equal(child.signalCode, null, stderr);
      assert.doesNotMatch(
        stderr,
        /UnhandledPromiseRejection|unhandledRejection/,
      );

      if (mode === "failure") {
        assert.match(stderr, /cause.*Original verification failure/);
        assert.match(stderr, /Cleanup failed: injected failure/);
        assert.match(stderr, /Cleanup timed out: injected timeout/);
      } else {
        assert.match(
          stderr,
          mode === "SIGTERM"
            ? /cause.*Verification interrupted: SIGTERM/
            : /cause.*Verification interrupted: SIGINT/,
        );
      }

      assert.match(resource.database, /^event_flow_verify_29a_[a-f0-9]{32}$/);
      assert.notEqual(resource.database, new URL(url).pathname.slice(1));
      assert.equal(
        (
          await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
            resource.database,
          ])
        ).rowCount,
        0,
      );

      if (resource.root) {
        assert.equal(
          path.dirname(resource.root),
          path.join(homedir(), "Library", "Application Support"),
        );
        assert.ok(
          path.basename(resource.root).startsWith("event-flow-verify-29a-"),
        );
        await assert.rejects(access(resource.root), { code: "ENOENT" });
      }

      if (resource.childPid) {
        const pid = resource.childPid;
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
      }
      console.log(
        `PASS: media ${stage}/${mode}; original failure retained; DB/media/child absent`,
      );
    }
  } finally {
    await admin.end();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
