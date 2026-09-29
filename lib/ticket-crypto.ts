import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
} from "node:crypto";
import { getServerEnv } from "@/lib/env";

const secretPattern = /^[A-Za-z0-9_-]{43}$/;
const numberAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function isTicketSecret(value: string) {
  return (
    secretPattern.test(value) &&
    Buffer.from(value, "base64url").toString("base64url") === value
  );
}

export function generateTicketSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashTicketSecret(secret: string) {
  if (!isTicketSecret(secret)) {
    throw new Error("Invalid Ticket secret format.");
  }

  return createHash("sha256").update(secret).digest("hex");
}

export function generateTicketNumber() {
  const characters = Array.from(
    { length: 8 },
    () => numberAlphabet[randomInt(numberAlphabet.length)],
  ).join("");

  return `EF-${characters.slice(0, 4)}-${characters.slice(4)}`;
}

// AAD binds both the Registration and the purpose, preventing envelope swapping.
export function encryptTicketSecret(
  secret: string,
  registrationId: string,
  purpose: "credential" | "access",
) {
  if (!isTicketSecret(secret)) {
    throw new Error("Invalid Ticket secret format.");
  }

  const key = Buffer.from(
    getServerEnv().TICKET_CREDENTIAL_ENCRYPTION_KEY,
    "base64url",
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(
    Buffer.from(`eventflow:ticket:v1:${registrationId}:${purpose}`),
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

export function decryptTicketSecret(
  envelope: string,
  registrationId: string,
  purpose: "credential" | "access",
  expectedHash: string,
) {
  const parts = envelope.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid Ticket encryption envelope.");
  }

  const [iv, ciphertext, tag] = parts.slice(1).map((part) => {
    const decoded = Buffer.from(part, "base64url");

    if (decoded.toString("base64url") !== part) {
      throw new Error("Invalid Ticket encryption encoding.");
    }

    return decoded;
  });

  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length !== 43) {
    throw new Error("Invalid Ticket encryption envelope.");
  }

  const key = Buffer.from(
    getServerEnv().TICKET_CREDENTIAL_ENCRYPTION_KEY,
    "base64url",
  );
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(
    Buffer.from(`eventflow:ticket:v1:${registrationId}:${purpose}`),
  );
  decipher.setAuthTag(tag);
  const secret = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  if (hashTicketSecret(secret) !== expectedHash) {
    throw new Error("Ticket credential integrity check failed.");
  }

  return secret;
}
