import "server-only";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { getServerEnv } from "@/lib/env";

export class MailDeliveryError extends Error {
  constructor(readonly retryAfterMs = 0) {
    super("Email delivery failed. Please try again later.");
  }
}

const globalForMail = globalThis as unknown as {
  resendPacing?: { nextStart: number; blockedUntil: number };
};
const pacing = globalForMail.resendPacing ?? {
  nextStart: 0,
  blockedUntil: 0,
};
globalForMail.resendPacing = pacing;

export function mailCooldownMs() {
  return Math.max(0, pacing.blockedUntil - Date.now());
}

export async function sendResendMail(
  message: { to: string; subject: string; text: string; html: string },
  timeoutMs: number,
  deliveryId?: string,
) {
  const env = getServerEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const now = Date.now();
    const wait = Math.max(0, pacing.nextStart - now, pacing.blockedUntil - now);

    if (wait >= timeoutMs - 1000) {
      throw new MailDeliveryError(wait);
    }

    // One request per second across outbox and verification in this process.
    pacing.nextStart = now + wait + 1000;
    await delay(wait, undefined, { signal: controller.signal });

    if (mailCooldownMs() > 0) {
      throw new MailDeliveryError(mailCooldownMs());
    }

    const body = JSON.stringify({
      from: `Event Flow <${env.SMTP_FROM}>`,
      ...message,
      to: [message.to],
    });
    // Approval content can change after revocation. Deduplicate identical
    // deliveries without replaying an earlier, now-inappropriate provider response.
    const digest = createHash("sha256").update(body).digest("hex");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${deliveryId ?? "verification"}/${digest}`,
      },
      body,
      redirect: "error",
      signal: controller.signal,
    });
    // Provider content is never logged, persisted or returned to callers.
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      let retryAfterMs = 0;
      const retryAfter = response.headers.get("retry-after");

      if (retryAfter) {
        const seconds = Number(retryAfter);
        retryAfterMs = Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(retryAfter) - Date.now();
      }

      if (response.status === 429) {
        const date = new Date();
        const quotaReset =
          result?.name === "daily_quota_exceeded"
            ? Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate() + 1,
              )
            : result?.name === "monthly_quota_exceeded"
              ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
              : Date.now() + 60_000;
        retryAfterMs = Math.max(
          Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
          quotaReset - Date.now(),
        );
      }

      retryAfterMs = Number.isFinite(retryAfterMs)
        ? Math.max(0, Math.min(retryAfterMs, 32 * 86400_000))
        : 0;
      pacing.blockedUntil = Math.max(
        pacing.blockedUntil,
        Date.now() + retryAfterMs,
      );
      throw new MailDeliveryError(retryAfterMs);
    }

    if (typeof result?.id !== "string" || result.id.length === 0) {
      throw new MailDeliveryError();
    }
  } catch (error) {
    throw error instanceof MailDeliveryError ? error : new MailDeliveryError();
  } finally {
    clearTimeout(timer);
  }
}
