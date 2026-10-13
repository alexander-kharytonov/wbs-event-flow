import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { eventPasswordSchema } from "@/features/events/event-password-input";
import { verifyEventPassword } from "@/features/events/server/event-password";
import { getServerEnv } from "@/lib/env";

function encryptionKey() {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(getServerEnv().TICKET_CREDENTIAL_ENCRYPTION_KEY, "base64url"),
      Buffer.alloc(0),
      "eventflow:event-password:v1",
      32,
    ),
  );
}

export function encryptEventPassword(
  password: string,
  eventId: string,
  hash: string,
) {
  eventPasswordSchema.parse(password);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`eventflow:event-password:v1:${eventId}:${hash}`));
  const ciphertext = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export async function decryptEventPassword(
  envelope: string,
  eventId: string,
  hash: string,
) {
  const parts = envelope.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid event password envelope.");
  }
  const [iv, ciphertext, tag] = parts.slice(1).map((part) => {
    const decoded = Buffer.from(part, "base64url");

    if (decoded.toString("base64url") !== part) {
      throw new Error("Invalid event password encoding.");
    }

    return decoded;
  });

  if (
    iv.length !== 12 ||
    tag.length !== 16 ||
    ciphertext.length < 10 ||
    ciphertext.length > 512
  ) {
    throw new Error("Invalid event password envelope.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(
    Buffer.from(`eventflow:event-password:v1:${eventId}:${hash}`),
  );
  decipher.setAuthTag(tag);
  const password = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  if (!(await verifyEventPassword(password, hash))) {
    throw new Error("Event password integrity check failed.");
  }

  return password;
}
