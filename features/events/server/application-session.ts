import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getServerEnv, getTrustedAppOrigins } from "@/lib/env";
import { isTicketSecret } from "@/lib/ticket-crypto";

export const applicationSessionSeconds = 2 * 60 * 60;
const aad = Buffer.from("eventflow:application-session:v1");
const sessionSchema = z.strictObject({
  applicationId: z.uuid(),
  capability: z.string().refine(isTicketSecret),
  expiresAt: z.number().int(),
});

function sessionKey() {
  return hkdfSync(
    "sha256",
    Buffer.from(getServerEnv().TICKET_CREDENTIAL_ENCRYPTION_KEY, "base64url"),
    Buffer.alloc(0),
    aad,
    32,
  );
}

export function applicationSessionCookie() {
  return getServerEnv().NODE_ENV === "production"
    ? "__Secure-ef-application"
    : "ef-application";
}

export function applicationSessionPath(applicationId: string) {
  return `/application/view/${z.uuid().parse(applicationId)}`;
}

export function isApplicationMutationOrigin(headers: Headers) {
  const origin = headers.get("origin");
  const site = headers.get("sec-fetch-site");

  return Boolean(
    origin &&
      getTrustedAppOrigins().includes(origin) &&
      (!site || site === "same-origin"),
  );
}

export function sealApplicationSession(
  applicationId: string,
  capability: string,
  now = Date.now(),
) {
  const payload = sessionSchema.parse({
    applicationId,
    capability,
    expiresAt: now + applicationSessionSeconds * 1000,
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

export function openApplicationSession(
  value: string,
  applicationId: string,
  now = Date.now(),
) {
  try {
    if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) {
      return null;
    }

    const bytes = Buffer.from(value, "base64url");

    if (bytes.length < 29 || bytes.toString("base64url") !== value) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      sessionKey(),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(bytes.subarray(12, 28));
    const plaintext = Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]);
    const session = sessionSchema.parse(JSON.parse(plaintext.toString("utf8")));

    if (
      session.applicationId !== applicationId ||
      session.expiresAt <= now ||
      session.expiresAt > now + applicationSessionSeconds * 1000
    ) {
      return null;
    }

    return session.capability;
  } catch {
    return null;
  }
}

export async function readApplicationSession(applicationId: string) {
  const name = applicationSessionCookie();
  const cookieHeader = (await headers()).get("cookie") ?? "";
  // Next.js collapses duplicate names before exposing cookies().
  const matches = cookieHeader
    .split(";")
    .filter((cookie) => cookie.split("=", 1)[0].trim() === name);

  if (matches.length !== 1) {
    return null;
  }

  const cookie = (await cookies()).get(name);

  return cookie ? openApplicationSession(cookie.value, applicationId) : null;
}
