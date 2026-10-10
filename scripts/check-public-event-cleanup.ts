// Targeted 29C cleanup checks. --integration uses only disposable verifier resources.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import {
  boundedCleanup,
  stopVerificationServer,
  verificationControl,
} from "./public-event-verification-cleanup";

async function main() {
  const baseline = [
    process.listenerCount("SIGINT"),
    process.listenerCount("SIGTERM"),
  ];
  const control = verificationControl();
  process.emit("SIGINT");
  const firstReason = control.signal.reason;
  process.emit("SIGTERM");
  process.emit("SIGINT");
  assert.match(firstReason.message, /SIGINT/);
  assert.equal(control.signal.reason, firstReason);
  control.dispose();
  assert.deepEqual(
    [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")],
    baseline,
  );

  const original = new Error("Original verification failure");
  const failures: unknown[] = [original];
  const completed: string[] = [];
  const unhandled: unknown[] = [];
  const recordUnhandled = (error: unknown) => unhandled.push(error);
  process.on("unhandledRejection", recordUnhandled);
  await boundedCleanup(
    [
      {
        name: "failure",
        run: async () => {
          throw new Error("Injected cleanup failure");
        },
      },
      {
        name: "timeout",
        run: () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Late rejection")), 80),
          ),
      },
      {
        name: "remaining resource",
        run: async () => {
          completed.push("removed");
        },
      },
    ],
    failures,
    20,
  );
  await delay(100);
  process.off("unhandledRejection", recordUnhandled);
  assert.equal(failures[0], original);
  assert.equal(failures.length, 3);
  assert.deepEqual(completed, ["removed"]);
  assert.deepEqual(unhandled, []);

  const stubborn = spawn(process.execPath, [
    "-e",
    "process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000)",
  ]);
  await once(stubborn.stdout, "data");
  await stopVerificationServer(stubborn, 30, 2000);
  assert.equal(stubborn.signalCode, "SIGKILL");
  await stopVerificationServer(stubborn);
  console.log(
    "PASS: repeated signals, first reason, bounded independent cleanup, late rejection, SIGKILL escalation and already-exited child",
  );

  if (!process.argv.includes("--integration")) {
    return;
  }

  loadEnvConfig(process.cwd(), true);
  const admin = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  await admin.connect();

  try {
    for (const [stage, mode] of [
      ["database", "SIGINT"],
      ["media", "SIGTERM"],
      ["server", "repeated"],
      ["server", "child-exit"],
    ] as const) {
      const child = spawn(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/check-public-event.ts",
          `--cleanup-probe=${stage}`,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      const exited = once(child, "exit");
      let stdout = "";
      let stderr = "";
      const errors: unknown[] = [];
      let resource:
        | { database: string; root?: string; serverPid?: number }
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
          assert.ok(resource);

          if (mode === "child-exit") {
            assert.ok(resource.serverPid);
            process.kill(resource.serverPid, "SIGTERM");
          } else {
            child.kill(mode === "repeated" ? "SIGINT" : mode);

            if (mode === "repeated") {
              child.kill("SIGTERM");
              child.kill("SIGINT");
            }
          }
        } catch (error) {
          errors.push(error);
          child.kill("SIGTERM");
        }
      });
      await boundedCleanup(
        [{ name: "probe exit", run: () => exited }],
        errors,
        45_000,
      );
      await stopVerificationServer(child);
      assert.deepEqual(errors, []);
      assert.ok(resource, stdout + stderr);
      assert.equal(child.exitCode, 1, stderr);
      assert.equal(child.signalCode, null, stderr);
      assert.match(
        stderr,
        mode === "child-exit"
          ? /server exited unexpectedly/
          : /Verification interrupted: SIG(INT|TERM)/,
      );
      assert.doesNotMatch(
        stderr,
        /unhandledRejection|UnhandledPromiseRejection/,
      );
      assert.match(resource.database, /^event_flow_verify_29c_[a-f0-9]{32}$/);
      assert.equal(
        (
          await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
            resource.database,
          ])
        ).rowCount,
        0,
      );

      if (resource.root) {
        await assert.rejects(access(resource.root), { code: "ENOENT" });
      }

      if (resource.serverPid) {
        const serverPid = resource.serverPid;
        assert.throws(() => process.kill(serverPid, 0), {
          code: "ESRCH",
        });
      }
      console.log(
        `PASS: ${stage}/${mode}; disposable database/media/server absent`,
      );
    }
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
