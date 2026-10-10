// Lifecycle helpers for the disposable 29C verifier and its failure-path checks.
import type { ChildProcess } from "node:child_process";

export function verificationControl(timeoutMs = 120_000) {
  const controller = new AbortController();
  const interrupt = (signal: NodeJS.Signals) => {
    // Repeated signals never interrupt cleanup or replace the first reason.
    if (!controller.signal.aborted) {
      controller.abort(new Error(`Verification interrupted: ${signal}`));
    }
  };
  const sigint = () => interrupt("SIGINT");
  const sigterm = () => interrupt("SIGTERM");
  process.on("SIGINT", sigint);
  process.on("SIGTERM", sigterm);
  const timer = setTimeout(() => {
    controller.abort(new Error("Verification deadline exceeded"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    abort: (error: Error) => controller.abort(error),
    dispose: () => {
      clearTimeout(timer);
      process.off("SIGINT", sigint);
      process.off("SIGTERM", sigterm);
    },
  };
}

export async function boundedCleanup(
  steps: { name: string; run: () => Promise<unknown> }[],
  failures: unknown[],
  timeoutMs = 10_000,
) {
  for (const step of steps) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        Promise.resolve().then(step.run),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Cleanup timed out: ${step.name}`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      failures.push(
        new Error(`Cleanup failed: ${step.name}`, { cause: error }),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function stopVerificationServer(
  child: ChildProcess | undefined,
  graceMs = 3000,
  killMs = 2000,
) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.off("exit", exited);
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
    child.once("error", failed);
    timer = setTimeout(() => {
      timer = setTimeout(
        () =>
          finish(new Error("Verification server did not exit after SIGKILL")),
        killMs,
      );
      child.kill("SIGKILL");
    }, graceMs);
    child.kill("SIGTERM");
  });
}

export function verificationInput(signal: AbortSignal) {
  signal.throwIfAborted();

  return new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off("data", data);
      process.stdin.off("end", end);
      signal.removeEventListener("abort", abort);
      process.stdin.pause();
    };
    const data = (value: Buffer) => {
      cleanup();
      resolve(value.toString().trim());
    };
    const end = () => {
      cleanup();
      resolve("");
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    process.stdin.once("data", data);
    process.stdin.once("end", end);
    signal.addEventListener("abort", abort, { once: true });
    process.stdin.resume();
  });
}
