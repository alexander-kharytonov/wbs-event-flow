import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerEnv, getTrustedAppOrigins } from "@/lib/env";

export const eventPasswordSessionSeconds = 2 * 60 * 60;
const grantSchema = z.strictObject({
  publicId: z.uuid(),
  grantId: z.uuid(),
  expiresAt: z.number().int(),
});

export function eventPasswordCookie(publicId: string) {
  return `${getServerEnv().NODE_ENV === "production" ? "__Secure-" : ""}ef-event-${z.uuid().parse(publicId)}`;
}

function signature(payload: string) {
  return createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(`eventflow:event-password-session:${payload}`)
    .digest("hex");
}

export function sealEventPasswordSession(
  publicId: string,
  grantId: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify(
      grantSchema.parse({
        publicId,
        grantId,
        expiresAt: now + eventPasswordSessionSeconds * 1000,
      }),
    ),
  ).toString("base64url");

  return `${payload}.${signature(payload)}`;
}

export function openEventPasswordSession(
  value: string,
  publicId: string,
  grantId: string,
  now = Date.now(),
) {
  try {
    if (value.length > 512 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) {
      return false;
    }
    const [payload, mac] = value.split(".");

    if (
      !timingSafeEqual(
        Buffer.from(mac, "hex"),
        Buffer.from(signature(payload), "hex"),
      )
    ) {
      return false;
    }
    const grant = grantSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );

    return (
      grant.publicId === publicId &&
      grant.grantId === grantId &&
      grant.expiresAt > now &&
      grant.expiresAt <= now + eventPasswordSessionSeconds * 1000
    );
  } catch {
    return false;
  }
}

export async function hasEventPasswordAccess(
  publicId: string,
  revision: { passwordHash: string | null; passwordGrantId: string | null },
) {
  if (!revision.passwordHash) {
    return revision.passwordGrantId === null;
  }

  if (!revision.passwordGrantId) {
    return false;
  }
  const name = eventPasswordCookie(publicId);
  const matches = ((await headers()).get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));

  return (
    matches.length === 1 &&
    openEventPasswordSession(
      matches[0].slice(name.length + 1),
      publicId,
      revision.passwordGrantId,
    )
  );
}

export function isEventPasswordOrigin(requestHeaders: Headers) {
  const origin = requestHeaders.get("origin");
  const site = requestHeaders.get("sec-fetch-site");

  return Boolean(
    origin &&
      getTrustedAppOrigins().includes(origin) &&
      (!site || site === "same-origin"),
  );
}
