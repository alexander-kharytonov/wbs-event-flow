import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";
import {
  generateTicketSecret,
  hashTicketSecret,
  isTicketSecret,
} from "@/lib/ticket-crypto";

// Separate application AAD prevents swapping attempts or Ticket envelopes.
export function encryptApplicationSecret(
  secret: string,
  applicationId: string,
) {
  if (!isTicketSecret(secret)) {
    throw new Error("Invalid Application secret format.");
  }

  const key = Buffer.from(
    getServerEnv().TICKET_CREDENTIAL_ENCRYPTION_KEY,
    "base64url",
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(
    Buffer.from(`eventflow:application:v1:${applicationId}:access`),
  );
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptApplicationSecret(
  envelope: string,
  applicationId: string,
  expectedHash: string,
) {
  const parts = envelope.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid Application encryption envelope.");
  }

  const [iv, ciphertext, tag] = parts.slice(1).map((part) => {
    const decoded = Buffer.from(part, "base64url");

    if (decoded.toString("base64url") !== part) {
      throw new Error("Invalid Application encryption encoding.");
    }

    return decoded;
  });

  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length !== 43) {
    throw new Error("Invalid Application encryption envelope.");
  }

  const key = Buffer.from(
    getServerEnv().TICKET_CREDENTIAL_ENCRYPTION_KEY,
    "base64url",
  );
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(
    Buffer.from(`eventflow:application:v1:${applicationId}:access`),
  );
  decipher.setAuthTag(tag);
  const secret = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  if (hashTicketSecret(secret) !== expectedHash) {
    throw new Error("Application credential integrity check failed.");
  }

  return secret;
}

export function createApplicationAccess(applicationId: string) {
  const secret = generateTicketSecret();

  return {
    anonymousAccessHash: hashTicketSecret(secret),
    anonymousAccessEncrypted: encryptApplicationSecret(secret, applicationId),
  };
}

export async function authorizeApplication(
  tx: Prisma.TransactionClient,
  capability: string,
) {
  if (!isTicketSecret(capability)) {
    return null;
  }

  return tx.application.findUnique({
    where: {
      anonymousAccessHash: hashTicketSecret(capability),
      status: { not: "WITHDRAWN" },
    },
    select: { id: true, eventId: true },
  });
}
